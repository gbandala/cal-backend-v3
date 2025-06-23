/**
 * 🎯 TIPOS Y CONFIGURACIONES PARA COMBINACIONES DE MEETING
 * 
 * Este archivo define todas las combinaciones válidas de meeting providers + calendar providers
 * y mapea desde los EventLocationEnumType existentes.
 */

// import { IntegrationAppTypeEnum } from "../../../database/entities/integration.entity";
import { IntegrationAppTypeEnum } from "../../../enums/integration.enum";

/**
 * Enum de todas las combinaciones de meeting soportadas
 */
export enum MeetingCombination {
  /** Google Meet integrado con Google Calendar (todo en uno) */
  GOOGLE_MEET_CALENDAR = 'google_meet_calendar',
  
  /** Zoom meetings + Google Calendar para tracking */
  ZOOM_GOOGLE_CALENDAR = 'zoom_google_calendar',
  
  /** Zoom meetings + Outlook Calendar para tracking */
  ZOOM_OUTLOOK_CALENDAR = 'zoom_outlook_calendar',
  
  /** Microsoft Teams + Outlook Calendar (futuro) */
  TEAMS_OUTLOOK_CALENDAR = 'teams_outlook_calendar',
  
  /** Microsoft Teams + Google Calendar (futuro) */
  TEAMS_GOOGLE_CALENDAR = 'teams_google_calendar',
  
  /** Google Meet + Outlook Calendar (futuro) */
  GOOGLE_MEET_OUTLOOK_CALENDAR = 'google_meet_outlook_calendar'
}

/**
 * Configuración de una combinación específica
 */
export interface CombinationConfig {
  /** Proveedor de meetings (zoom, teams, google_meet) */
  meetingProvider: string;
  
  /** Proveedor de calendario (google_calendar, outlook_calendar) */
  calendarProvider: string;
  
  /** Lista de integraciones requeridas del usuario */
  requiredIntegrations: IntegrationAppTypeEnum[];
  
  /** Indica si está implementada y lista para usar */
  isImplemented: boolean;
  
  /** Descripción humana de la combinación */
  description: string;
  
  /** Configuraciones específicas de esta combinación */
  config?: {
    /** Si el meeting provider puede generar automáticamente el calendario */
    autoCalendarCreation?: boolean;
    
    /** Si requiere calendar_id específico o puede usar primary */
    requiresSpecificCalendar?: boolean;
    
    /** Configuraciones por defecto para meetings */
    defaultMeetingSettings?: Record<string, any>;
    
    /** Configuraciones por defecto para calendario */
    defaultCalendarSettings?: Record<string, any>;
  };
}

/**
 * Mapeo completo de todas las combinaciones y sus configuraciones
 */
export const COMBINATION_CONFIGS: Record<MeetingCombination, CombinationConfig> = {
  [MeetingCombination.GOOGLE_MEET_CALENDAR]: {
    meetingProvider: 'google_meet',
    calendarProvider: 'google_calendar',
    requiredIntegrations: [IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR],
    isImplemented: true,
    description: 'Google Meet with Google Calendar integration',
    config: {
      autoCalendarCreation: true,
      requiresSpecificCalendar: false,
      defaultMeetingSettings: {
        enableVideo: true,
        enableAudio: true
      }
    }
  },
  
  [MeetingCombination.ZOOM_GOOGLE_CALENDAR]: {
    meetingProvider: 'zoom',
    calendarProvider: 'google_calendar',
    requiredIntegrations: [
      IntegrationAppTypeEnum.ZOOM_MEETING,
      IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR
    ],
    isImplemented: true,
    description: 'Zoom meetings with Google Calendar tracking',
    config: {
      autoCalendarCreation: false,
      requiresSpecificCalendar: false,
      defaultMeetingSettings: {
        host_video: true,
        participant_video: true,
        waiting_room: true,
        join_before_host: false
      }
    }
  },
  
  [MeetingCombination.ZOOM_OUTLOOK_CALENDAR]: {
    meetingProvider: 'zoom',
    calendarProvider: 'outlook_calendar',
    requiredIntegrations: [
      IntegrationAppTypeEnum.ZOOM_MEETING,
      IntegrationAppTypeEnum.OUTLOOK_CALENDAR
    ],
    isImplemented: true, // ✅ Esta es la nueva combinación que vamos a implementar
    description: 'Zoom meetings with Outlook Calendar tracking',
    config: {
      autoCalendarCreation: false,
      requiresSpecificCalendar: false,
      defaultMeetingSettings: {
        host_video: true,
        participant_video: true,
        waiting_room: true,
        join_before_host: false
      }
    }
  },
  
  [MeetingCombination.TEAMS_OUTLOOK_CALENDAR]: {
    meetingProvider: 'teams',
    calendarProvider: 'outlook_calendar',
    requiredIntegrations: [
      IntegrationAppTypeEnum.OUTLOOK_WITH_TEAMS,
      IntegrationAppTypeEnum.OUTLOOK_CALENDAR
    ],
    isImplemented: false, // 🚀 Implementación futura
    description: 'Microsoft Teams with Outlook Calendar integration',
    config: {
      autoCalendarCreation: true,
      requiresSpecificCalendar: false,
      defaultMeetingSettings: {
        allowedPresenters: 'everyone',
        enableLobby: true
      }
    }
  },
  
  [MeetingCombination.TEAMS_GOOGLE_CALENDAR]: {
    meetingProvider: 'teams',
    calendarProvider: 'google_calendar',
    requiredIntegrations: [
      IntegrationAppTypeEnum.OUTLOOK_WITH_TEAMS,
      IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR
    ],
    isImplemented: false, // 🚀 Implementación futura
    description: 'Microsoft Teams with Google Calendar tracking'
  },
  
  [MeetingCombination.GOOGLE_MEET_OUTLOOK_CALENDAR]: {
    meetingProvider: 'google_meet',
    calendarProvider: 'outlook_calendar',
    requiredIntegrations: [
      IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR,
      IntegrationAppTypeEnum.OUTLOOK_CALENDAR
    ],
    isImplemented: false, // 🚀 Implementación futura
    description: 'Google Meet with Outlook Calendar tracking'
  }
};

/**
 * Utilidades para trabajar con combinaciones
 */
export class CombinationUtils {
  /**
   * Obtiene todas las combinaciones implementadas
   */
  static getImplementedCombinations(): MeetingCombination[] {
    return Object.entries(COMBINATION_CONFIGS)
      .filter(([_, config]) => config.isImplemented)
      .map(([combination, _]) => combination as MeetingCombination);
  }
  
  /**
   * Obtiene todas las combinaciones futuras (no implementadas)
   */
  static getFutureCombinations(): MeetingCombination[] {
    return Object.entries(COMBINATION_CONFIGS)
      .filter(([_, config]) => !config.isImplemented)
      .map(([combination, _]) => combination as MeetingCombination);
  }
  
  /**
   * Verifica si una combinación está implementada
   */
  static isImplemented(combination: MeetingCombination): boolean {
    return COMBINATION_CONFIGS[combination]?.isImplemented || false;
  }
  
  /**
   * Obtiene la configuración de una combinación
   */
  static getConfig(combination: MeetingCombination): CombinationConfig {
    const config = COMBINATION_CONFIGS[combination];
    if (!config) {
      throw new Error(`Unknown combination: ${combination}`);
    }
    return config;
  }
  
  /**
   * Obtiene las integraciones requeridas para una combinación
   */
  static getRequiredIntegrations(combination: MeetingCombination): IntegrationAppTypeEnum[] {
    return this.getConfig(combination).requiredIntegrations;
  }
}