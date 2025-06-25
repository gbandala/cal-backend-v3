import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database.config';
import { UserCalendar } from '../database/entities/user-calendar.entity';
import { User } from '../database/entities/user.entity';
import { Integration } from '../database/entities/integration.entity';
import { CalendarSummaryDto, CalendarFilterDto, SyncCalendarsDto } from '../database/dto/calendar.dto';
import { BadRequestException } from '../utils/app-error';
import { google } from 'googleapis';
import { getOutlookCalendars, isPersonalOutlookAccount } from './outlook.service';

// ============================================
// 🔧 INTERFACES Y TIPOS
// ============================================

interface UserCalendarData {
  userId: string;
  calendarId: string;
  calendarName: string;
  isPrimary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
  isActive?: boolean;
}

export class CalendarService {
  private userCalendarRepository: Repository<UserCalendar>;
  private userRepository: Repository<User>;
  private integrationRepository: Repository<Integration>;

  constructor() {
    this.userCalendarRepository = AppDataSource.getRepository(UserCalendar);
    this.userRepository = AppDataSource.getRepository(User);
    this.integrationRepository = AppDataSource.getRepository(Integration);
  }

  // ============================================
  // 🎯 MÉTODOS ORIGINALES DEL CALENDAR SERVICE
  // ============================================

  // Obtener calendarios del usuario desde cache/BD
  async getUserCalendarsService(userId: string, filters?: CalendarFilterDto): Promise<CalendarSummaryDto[]> {
    try {
      let query = this.userCalendarRepository
        .createQueryBuilder('uc')
        .where('uc.userId = :userId', { userId });

      // Aplicar filtros opcionales
      if (filters?.onlyActive) {
        query = query.andWhere('uc.isActive = :isActive', { isActive: true });
      }

      if (filters?.onlyWritable) {
        query = query.andWhere('uc.accessRole IN (:...roles)', { 
          roles: ['owner', 'writer'] 
        });
      }

      query = query.orderBy('uc.isPrimary', 'DESC')
                  .addOrderBy('uc.calendarName', 'ASC');

      const calendars = await query.getMany();

      // Si no hay calendarios en cache, sincronizar desde Google
      if (calendars.length === 0) {
        await this.syncUserCalendarsService(userId, { forceRefresh: true });
        // Volver a consultar después de la sincronización
        return this.getUserCalendarsService(userId, filters);
      }

      // Formatear respuesta
      return calendars.map(calendar => ({
        id: calendar.calendarId,
        name: calendar.calendarName,
        isPrimary: calendar.isPrimary,
        accessRole: calendar.accessRole,
        backgroundColor: calendar.backgroundColor,
        isActive: calendar.isActive
      }));

    } catch (error) {
      console.error('Error al obtener calendarios del usuario:', error);
      throw new Error('No se pudieron obtener los calendarios del usuario');
    }
  }

  // Sincronizar calendarios desde Google API
  async syncUserCalendarsService(userId: string, options: SyncCalendarsDto): Promise<{ synced: number; total: number }> {
    try {
      // Obtener integración de Google Calendar del usuario
      const integration = await this.integrationRepository.findOne({
        where: { 
          userId: userId,
          provider: 'GOOGLE' as any,
          category: 'CALENDAR_AND_VIDEO_CONFERENCING' as any,
          isConnected: true
        }
      });

      if (!integration) {
        throw new Error('Integración de Google Calendar no encontrada o no conectada');
      }

      // Configurar cliente OAuth2
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        access_token: integration.access_token,
        refresh_token: integration.refresh_token,
        expiry_date: integration.expiry_date
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Obtener lista de calendarios desde Google API
      const response = await calendar.calendarList.list({
        minAccessRole: 'reader'
      });

      const googleCalendars = response.data.items || [];

      // Si forceRefresh, eliminar calendarios existentes
      if (options.forceRefresh) {
        await AppDataSource.manager.query(
          'DELETE FROM user_calendars WHERE user_id = $1', 
          [userId]
        );
      }

      // Guardar/actualizar calendarios en cache
      let syncedCount = 0;
      
      for (const gCal of googleCalendars) {
        try {
          // Insertar cada calendario individualmente
          await AppDataSource.manager.query(`
            INSERT INTO user_calendars (
              "user_id", "calendar_id", "calendar_name", "is_primary", 
              "access_role", "background_color", "is_active", "last_synced",
              "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            userId,
            gCal.id,
            gCal.summary || gCal.id,
            gCal.primary || false,
            gCal.accessRole || 'reader',
            gCal.backgroundColor || null,
            true,
            new Date(),
            new Date(), // createdAt
            new Date()  // updatedAt
          ]);
          
          syncedCount++;
        } catch (saveError) {
          console.error(`Error al guardar calendario ${gCal.id}:`, saveError);
        }
      }

      return {
        synced: syncedCount,
        total: googleCalendars.length
      };

    } catch (error) {
      console.error('Error al sincronizar calendarios:', error);
      throw new Error('No se pudieron sincronizar los calendarios desde Google');
    }
  }

  // Obtener detalles de un calendario específico
  async getCalendarDetailsService(userId: string, calendarId: string): Promise<CalendarSummaryDto | null> {
    try {
      const calendar = await this.userCalendarRepository.findOne({
        where: {
          userId: userId,
          calendarId: calendarId,
          isActive: true
        }
      });

      if (!calendar) {
        return null;
      }

      return {
        id: calendar.calendarId,
        name: calendar.calendarName,
        isPrimary: calendar.isPrimary,
        accessRole: calendar.accessRole,
        backgroundColor: calendar.backgroundColor,
        isActive: calendar.isActive
      };

    } catch (error) {
      console.error('Error al obtener detalles del calendario:', error);
      throw new Error('No se pudieron obtener los detalles del calendario');
    }
  }

  // Validar que el usuario tiene acceso a un calendario específico
  async validateUserCalendarAccess(userId: string, calendarId: string): Promise<boolean> {
    try {
      const calendar = await this.userCalendarRepository.findOne({
        where: {
          userId: userId,
          calendarId: calendarId,
          isActive: true
        }
      });

      return !!calendar;
    } catch (error) {
      console.error('Error al validar acceso al calendario:', error);
      return false;
    }
  }

  // Obtener calendar_id por defecto del usuario (primary o el primero disponible)
  async getDefaultCalendarId(userId: string): Promise<string> {
    try {
      // Buscar calendario primary primero
      let calendar = await this.userCalendarRepository.findOne({
        where: {
          userId: userId,
          isPrimary: true,
          isActive: true
        }
      });

      // Si no hay primary, tomar el primero disponible
      if (!calendar) {
        calendar = await this.userCalendarRepository.findOne({
          where: {
            userId: userId,
            isActive: true
          },
          order: {
            calendarName: 'ASC'
          }
        });
      }

      return calendar?.calendarId || 'primary';
    } catch (error) {
      console.error('Error al obtener calendario por defecto:', error);
      return 'primary';
    }
  }

  // ============================================
  // 🔧 FUNCIONES CONSOLIDADAS DE USER-CALENDARS SERVICE
  // ============================================

  /**
   * Sincroniza calendarios de Outlook con user_calendars
   * Maneja tanto cuentas empresariales como personales
   */
  async syncOutlookCalendarsService(
    userId: string, 
    accessToken: string
  ): Promise<UserCalendar[]> {
    try {
      console.log('🔄 [CALENDAR_SERVICE] Syncing Outlook calendars for user:', userId);

      // 1. Detectar tipo de cuenta y obtener calendarios
      let userInfo: any = null;
      try {
        const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (userResponse.ok) {
          userInfo = await userResponse.json();
        }
      } catch (error) {
        console.log('⚠️ Could not get user info, will try both methods');
      }

      // 2. Usar estrategia apropiada para obtener calendarios
      const outlookCalendars = await getOutlookCalendars(accessToken);
      
      console.log('📅 Calendars obtained:', {
        count: outlookCalendars.length,
        calendars: outlookCalendars.map((cal: any) => ({ 
          id: cal.id, 
          name: cal.name, 
          isDefault: cal.isDefaultCalendar,
          source: (cal as any).source || 'standard'
        }))
      });

      // 3. Preparar datos para user_calendars
      const userCalendarData: UserCalendarData[] = outlookCalendars.map((calendar: any) => ({
        userId,
        calendarId: calendar.id,
        calendarName: calendar.name,
        isPrimary: calendar.isDefaultCalendar,
        accessRole: calendar.canEdit ? 'owner' : 'reader',
        backgroundColor: '#0078d4',
        isActive: true
      }));

      // 4. Guardar calendarios en user_calendars
      const savedCalendars = await this.saveUserCalendarsService(userCalendarData);
      
      // 5. Desactivar calendarios obsoletos
      const activeCalendarIds = outlookCalendars.map((cal: any) => cal.id);
      await this.deactivateObsoleteCalendarsService(userId, activeCalendarIds);
      
      console.log('✅ [CALENDAR_SERVICE] Successfully synced Outlook calendars:', {
        userId,
        accountType: userInfo && isPersonalOutlookAccount(userInfo) ? 'personal' : 'business/unknown',
        calendarsSaved: savedCalendars.length,
        hasConsultorias: savedCalendars.some(cal => 
          cal.calendarName.toLowerCase().includes('consultor')
        )
      });

      return savedCalendars;

    } catch (error) {
      console.error('❌ [CALENDAR_SERVICE] Error syncing Outlook calendars:', error);
      throw new BadRequestException('Failed to sync Outlook calendars');
    }
  }

  /**
   * Guarda múltiples calendarios en user_calendars
   * Usa UPSERT para evitar duplicados
   */
  async saveUserCalendarsService(calendarsData: UserCalendarData[]): Promise<UserCalendar[]> {
    const savedCalendars: UserCalendar[] = [];

    try {
      for (const calendarData of calendarsData) {
        // Buscar calendario existente
        let existingCalendar = await this.userCalendarRepository.findOne({
          where: {
            userId: calendarData.userId,
            calendarId: calendarData.calendarId
          }
        });

        if (existingCalendar) {
          // Actualizar calendario existente
          existingCalendar.calendarName = calendarData.calendarName;
          existingCalendar.isPrimary = calendarData.isPrimary || false;
          existingCalendar.accessRole = calendarData.accessRole ?? 'owner';
          existingCalendar.backgroundColor = calendarData.backgroundColor || '#0078d4';
          existingCalendar.isActive = calendarData.isActive !== false;
          existingCalendar.lastSynced = new Date();

          const updated = await this.userCalendarRepository.save(existingCalendar);
          savedCalendars.push(updated);
          
          console.log('🔄 Updated existing calendar:', {
            id: updated.id,
            name: updated.calendarName,
            isPrimary: updated.isPrimary
          });
        } else {
          // Crear nuevo calendario
          const newCalendar = this.userCalendarRepository.create({
            userId: calendarData.userId,
            calendarId: calendarData.calendarId,
            calendarName: calendarData.calendarName,
            isPrimary: calendarData.isPrimary || false,
            accessRole: calendarData.accessRole || 'owner',
            backgroundColor: calendarData.backgroundColor || '#0078d4',
            isActive: calendarData.isActive !== false,
            lastSynced: new Date()
          });

          const saved = await this.userCalendarRepository.save(newCalendar);
          savedCalendars.push(saved);
          
          console.log('✅ Created new calendar:', {
            id: saved.id,
            name: saved.calendarName,
            isPrimary: saved.isPrimary
          });
        }
      }

      return savedCalendars;

    } catch (error) {
      console.error('❌ Error saving user calendars:', error);
      throw new BadRequestException('Failed to save user calendars');
    }
  }

  /**
   * Desactiva calendarios obsoletos (para limpiar después de sync)
   */
  async deactivateObsoleteCalendarsService(
    userId: string,
    activeCalendarIds: string[]
  ): Promise<void> {
    try {
      // Desactivar calendarios que ya no existen en Outlook
      await this.userCalendarRepository
        .createQueryBuilder()
        .update(UserCalendar)
        .set({ isActive: false })
        .where('userId = :userId', { userId })
        .andWhere('calendarId NOT IN (:...activeIds)', { activeIds: activeCalendarIds })
        .andWhere('isActive = true')
        .execute();

      console.log('🧹 Deactivated obsolete calendars for user:', userId);

    } catch (error) {
      console.error('❌ Error deactivating obsolete calendars:', error);
      // No throw - esto no debería romper el flujo principal
    }
  }

  /**
   * Crea un calendario por defecto para cuentas personales
   * Se usa como fallback cuando falla la sincronización automática
   */
  async createDefaultCalendarForUser(
    userId: string,
    calendarId: string = 'primary',
    calendarName: string = 'My Calendar'
  ): Promise<UserCalendar> {
    try {
      console.log('🔧 [CALENDAR_SERVICE] Creating default calendar for user:', { 
        userId, 
        calendarId, 
        calendarName 
      });

      const calendarData: UserCalendarData = {
        userId,
        calendarId,
        calendarName,
        isPrimary: true,
        accessRole: 'owner',
        backgroundColor: '#0078d4',
        isActive: true
      };

      const savedCalendars = await this.saveUserCalendarsService([calendarData]);
      
      console.log('✅ [CALENDAR_SERVICE] Default calendar created successfully');
      return savedCalendars[0];

    } catch (error) {
      console.error('❌ [CALENDAR_SERVICE] Error creating default calendar:', error);
      throw new BadRequestException('Failed to create default calendar');
    }
  }

  /**
   * Obtiene calendarios activos de un usuario
   */
  async getUserCalendarsListService(userId: string): Promise<UserCalendar[]> {
    try {
      const calendars = await this.userCalendarRepository.find({
        where: {
          userId: userId,
          isActive: true
        },
        order: {
          isPrimary: 'DESC', // Primario primero
          calendarName: 'ASC'
        }
      });

      console.log('📅 [CALENDAR_SERVICE] Retrieved user calendars:', {
        userId,
        count: calendars.length,
        primaryCalendar: calendars.find(cal => cal.isPrimary)?.calendarName
      });

      return calendars;

    } catch (error) {
      console.error('❌ [CALENDAR_SERVICE] Error getting user calendars:', error);
      throw new BadRequestException('Failed to get user calendars');
    }
  }

  /**
   * Obtiene el calendario primario de un usuario
   */
  async getPrimaryUserCalendarService(userId: string): Promise<UserCalendar | null> {
    try {
      const primaryCalendar = await this.userCalendarRepository.findOne({
        where: {
          userId: userId,
          isPrimary: true,
          isActive: true
        }
      });

      if (!primaryCalendar) {
        // Si no hay primario, obtener el primero activo
        const firstCalendar = await this.userCalendarRepository.findOne({
          where: {
            userId: userId,
            isActive: true
          },
          order: {
            createdAt: 'ASC'
          }
        });

        return firstCalendar;
      }

      return primaryCalendar;

    } catch (error) {
      console.error('❌ [CALENDAR_SERVICE] Error getting primary calendar:', error);
      return null;
    }
  }

  /**
   * Obtiene estadísticas de calendarios de un usuario
   */
  async getCalendarStatsService(userId: string) {
    try {
      const calendars = await this.userCalendarRepository.find({
        where: { userId: userId }
      });

      const stats = {
        totalCalendars: calendars.length,
        activeCalendars: calendars.filter(cal => cal.isActive).length,
        inactiveCalendars: calendars.filter(cal => !cal.isActive).length,
        primaryCalendar: calendars.find(cal => cal.isPrimary)?.calendarName || null,
        lastSyncDates: calendars
          .filter(cal => cal.lastSynced)
          .map(cal => ({
            calendarName: cal.calendarName,
            lastSynced: cal.lastSynced
          })),
        oldestSync: calendars
          .filter(cal => cal.lastSynced)
          .sort((a, b) => a.lastSynced!.getTime() - b.lastSynced!.getTime())[0]?.lastSynced || null
      };

      return stats;

    } catch (error) {
      console.error('❌ [CALENDAR_SERVICE] Error getting calendar stats:', error);
      return {
        totalCalendars: 0,
        activeCalendars: 0,
        inactiveCalendars: 0,
        primaryCalendar: null,
        lastSyncDates: [],
        oldestSync: null
      };
    }
  }
}