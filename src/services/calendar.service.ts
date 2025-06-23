import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database.config';
import { UserCalendar } from '../database/entities/user-calendar.entity';
import { User } from '../database/entities/user.entity';
import { Integration } from '../database/entities/integration.entity';
import { CalendarSummaryDto, CalendarFilterDto, SyncCalendarsDto } from '../database/dto/calendar.dto';
import { google } from 'googleapis';

export class CalendarService {
  private userCalendarRepository: Repository<UserCalendar>;
  private userRepository: Repository<User>;
  private integrationRepository: Repository<Integration>;

  constructor() {
    this.userCalendarRepository = AppDataSource.getRepository(UserCalendar);
    this.userRepository = AppDataSource.getRepository(User);
    this.integrationRepository = AppDataSource.getRepository(Integration);
  }

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
}