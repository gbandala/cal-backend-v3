// services/user-calendars.service.ts
import { AppDataSource } from "../config/database.config";
import { UserCalendar } from "../database/entities/user-calendar.entity";
import { BadRequestException } from "../utils/app-error";
import { getOutlookCalendars } from "./outlook.service";
import { getPersonalOutlookCalendars, isPersonalOutlookAccount } from "./outlook-personal.service";
/**
 * SERVICIO PARA GESTIONAR USER CALENDARS DE OUTLOOK
 * 
 * Maneja la sincronización y gestión de calendarios de usuarios
 * específicamente para Microsoft Outlook, incluyendo cuentas personales.
 */

interface UserCalendarData {
  userId: string;
  calendarId: string;
  calendarName: string;
  isPrimary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
  isActive?: boolean;
}

/**
 * Sincroniza calendarios de Outlook con user_calendars
 * Maneja tanto cuentas empresariales como personales
 */
// export const syncOutlookCalendarsService = async (
//   userId: string, 
//   accessToken: string
// ): Promise<UserCalendar[]> => {
//   try {
//     console.log('🔄 Syncing Outlook calendars for user:', userId);

//     // 1. Obtener calendarios de Outlook (con fallback para cuentas personales)
//     const outlookCalendars = await getOutlookCalendars(accessToken);
//     console.log('📅 Found Outlook calendars:', {
//       count: outlookCalendars.length,
//       calendars: outlookCalendars.map(cal => ({ 
//         id: cal.id, 
//         name: cal.name, 
//         isDefault: cal.isDefaultCalendar 
//       }))
//     });

//     // 2. Preparar datos para user_calendars
//     const userCalendarData: UserCalendarData[] = outlookCalendars.map(calendar => ({
//       userId,
//       calendarId: calendar.id,
//       calendarName: calendar.name,
//       isPrimary: calendar.isDefaultCalendar,
//       accessRole: calendar.canEdit ? 'owner' : 'reader',
//       backgroundColor: '#0078d4', // Color por defecto de Outlook
//       isActive: true
//     }));

//     // 3. Guardar calendarios en user_calendars
//     const savedCalendars = await saveUserCalendarsService(userCalendarData);
    
//     // 4. Desactivar calendarios obsoletos
//     const activeCalendarIds = outlookCalendars.map(cal => cal.id);
//     await deactivateObsoleteCalendarsService(userId, activeCalendarIds);
    
//     console.log('✅ Successfully synced Outlook calendars:', {
//       userId,
//       calendarsSaved: savedCalendars.length
//     });

//     return savedCalendars;

//   } catch (error) {
//     console.error('❌ Error syncing Outlook calendars:', error);
//     throw new BadRequestException('Failed to sync Outlook calendars');
//   }
// };

export const syncOutlookCalendarsService = async (
  userId: string, 
  accessToken: string
): Promise<UserCalendar[]> => {
  try {
    console.log('🔄 [UPDATED] Syncing Outlook calendars with smart detection...');

    // 1. Obtener info del usuario para detectar tipo de cuenta
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

    // 2. Detectar si es cuenta personal y usar estrategia apropiada
    let outlookCalendars: any[] = [];
    
    if (userInfo && isPersonalOutlookAccount(userInfo)) {
      console.log('🏠 Personal account detected - using specialized method');
      
      // USAR NUEVA ESTRATEGIA PARA CUENTAS PERSONALES
      outlookCalendars = await getPersonalOutlookCalendars(accessToken);
      
    } else {
      console.log('🏢 Business account or unknown - trying standard method first');
      
      try {
        // Intentar método estándar primero
        outlookCalendars = await getOutlookCalendars(accessToken);
        
      } catch (standardError) {
        console.log('⚠️ Standard method failed, falling back to personal method');
        outlookCalendars = await getPersonalOutlookCalendars(accessToken);
      }
    }

    console.log('📅 Calendars obtained:', {
      count: outlookCalendars.length,
      calendars: outlookCalendars.map(cal => ({ 
        id: cal.id, 
        name: cal.name, 
        isDefault: cal.isDefaultCalendar,
        source: cal.source || 'standard'
      }))
    });

    // 3. Preparar datos para user_calendars (igual que antes)
    const userCalendarData: UserCalendarData[] = outlookCalendars.map(calendar => ({
      userId,
      calendarId: calendar.id,
      calendarName: calendar.name,
      isPrimary: calendar.isDefaultCalendar,
      accessRole: calendar.canEdit ? 'owner' : 'reader',
      backgroundColor: '#0078d4',
      isActive: true
    }));

    // 4. Guardar calendarios en user_calendars
    const savedCalendars = await saveUserCalendarsService(userCalendarData);
    
    // 5. Desactivar calendarios obsoletos
    const activeCalendarIds = outlookCalendars.map(cal => cal.id);
    await deactivateObsoleteCalendarsService(userId, activeCalendarIds);
    
    console.log('✅ [UPDATED] Successfully synced Outlook calendars:', {
      userId,
      accountType: userInfo && isPersonalOutlookAccount(userInfo) ? 'personal' : 'business/unknown',
      calendarsSaved: savedCalendars.length,
      hasConsultorias: savedCalendars.some(cal => 
        cal.calendarName.toLowerCase().includes('consultor')
      )
    });

    return savedCalendars;

  } catch (error) {
    console.error('❌ [UPDATED] Error syncing Outlook calendars:', error);
    throw new BadRequestException('Failed to sync Outlook calendars');
  }
};
/**
 * Guarda múltiples calendarios en user_calendars
 * Usa UPSERT para evitar duplicados
 */
export const saveUserCalendarsService = async (
  calendarsData: UserCalendarData[]
): Promise<UserCalendar[]> => {
  const userCalendarRepository = AppDataSource.getRepository(UserCalendar);
  const savedCalendars: UserCalendar[] = [];

  try {
    for (const calendarData of calendarsData) {
      // Buscar calendario existente
      let existingCalendar = await userCalendarRepository.findOne({
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

        const updated = await userCalendarRepository.save(existingCalendar);
        savedCalendars.push(updated);
        
        console.log('🔄 Updated existing calendar:', {
          id: updated.id,
          name: updated.calendarName,
          isPrimary: updated.isPrimary
        });
      } else {
        // Crear nuevo calendario
        const newCalendar = userCalendarRepository.create({
          userId: calendarData.userId,
          calendarId: calendarData.calendarId,
          calendarName: calendarData.calendarName,
          isPrimary: calendarData.isPrimary || false,
          accessRole: calendarData.accessRole || 'owner',
          backgroundColor: calendarData.backgroundColor || '#0078d4',
          isActive: calendarData.isActive !== false,
          lastSynced: new Date()
        });

        const saved = await userCalendarRepository.save(newCalendar);
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
};

/**
 * Obtiene calendarios activos de un usuario
 */
export const getUserCalendarsService = async (userId: string): Promise<UserCalendar[]> => {
  const userCalendarRepository = AppDataSource.getRepository(UserCalendar);

  try {
    const calendars = await userCalendarRepository.find({
      where: {
        userId: userId,
        isActive: true
      },
      order: {
        isPrimary: 'DESC', // Primario primero
        calendarName: 'ASC'
      }
    });

    console.log('📅 Retrieved user calendars:', {
      userId,
      count: calendars.length,
      primaryCalendar: calendars.find(cal => cal.isPrimary)?.calendarName
    });

    return calendars;

  } catch (error) {
    console.error('❌ Error getting user calendars:', error);
    throw new BadRequestException('Failed to get user calendars');
  }
};

/**
 * Desactiva calendarios obsoletos (para limpiar después de sync)
 */
export const deactivateObsoleteCalendarsService = async (
  userId: string,
  activeCalendarIds: string[]
): Promise<void> => {
  const userCalendarRepository = AppDataSource.getRepository(UserCalendar);

  try {
    // Desactivar calendarios que ya no existen en Outlook
    await userCalendarRepository
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
};

/**
 * Obtiene el calendario primario de un usuario
 */
export const getPrimaryUserCalendarService = async (userId: string): Promise<UserCalendar | null> => {
  const userCalendarRepository = AppDataSource.getRepository(UserCalendar);

  try {
    const primaryCalendar = await userCalendarRepository.findOne({
      where: {
        userId: userId,
        isPrimary: true,
        isActive: true
      }
    });

    if (!primaryCalendar) {
      // Si no hay primario, obtener el primero activo
      const firstCalendar = await userCalendarRepository.findOne({
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
    console.error('❌ Error getting primary calendar:', error);
    return null;
  }
};

/**
 * Crea un calendario por defecto para cuentas personales
 * Se usa como fallback cuando falla la sincronización automática
 */
export const createDefaultCalendarForUser = async (
  userId: string,
  calendarId: string = 'primary',
  calendarName: string = 'My Calendar'
): Promise<UserCalendar> => {
  try {
    console.log('🔧 Creating default calendar for user:', { userId, calendarId, calendarName });

    const calendarData: UserCalendarData = {
      userId,
      calendarId,
      calendarName,
      isPrimary: true,
      accessRole: 'owner',
      backgroundColor: '#0078d4',
      isActive: true
    };

    const savedCalendars = await saveUserCalendarsService([calendarData]);
    
    console.log('✅ Default calendar created successfully');
    return savedCalendars[0];

  } catch (error) {
    console.error('❌ Error creating default calendar:', error);
    throw new BadRequestException('Failed to create default calendar');
  }
};

/**
 * Obtiene estadísticas de calendarios de un usuario
 */
export const getCalendarStatsService = async (userId: string) => {
  const userCalendarRepository = AppDataSource.getRepository(UserCalendar);

  try {
    const calendars = await userCalendarRepository.find({
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
    console.error('❌ Error getting calendar stats:', error);
    return {
      totalCalendars: 0,
      activeCalendars: 0,
      inactiveCalendars: 0,
      primaryCalendar: null,
      lastSyncDates: [],
      oldestSync: null
    };
  }
};