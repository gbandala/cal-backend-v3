/**
 * 🎥 INTERFAZ PARA PROVEEDORES DE MEETING
 * 
 * Esta interfaz abstrae las operaciones de plataformas de videoconferencia 
 * (Zoom, Microsoft Teams, Google Meet, etc.)
 */

import { TokenConfig } from "./calendar-provider.interface";

/**
 * Configuración para crear un meeting
 */
export interface MeetingConfig {
  topic: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  agenda?: string;
  settings?: {
    hostVideo?: boolean;
    participantVideo?: boolean;
    joinBeforeHost?: boolean;
    waitingRoom?: boolean;
    muteUponEntry?: boolean;
    autoRecording?: 'none' | 'local' | 'cloud';
    password?: string;
    [key: string]: any;
  };

  /** ID del usuario que crea el meeting (para contexto) */
  userId?: string;
}

/**
 * Información del meeting creado
 */
export interface MeetingInfo {
  id: string | number;
  joinUrl: string;
  startUrl?: string;
  passcode?: string;
  dialInNumbers?: {
    country: string;
    number: string;
    type: 'toll' | 'toll_free';
  }[];

  /** Datos adicionales específicos del proveedor */
  additionalData?: {
    uuid?: string;
    hostId?: string;
    duration?: number;
    settings?: any;
    webinarId?: string | number; // Para webinars
    [key: string]: any;
  };
}

/**
 * Resultado de operaciones de meeting
 */
export interface MeetingOperationResult {
  success: boolean;
  meetingInfo?: MeetingInfo;
  error?: string;
  providerResponse?: any;
}

/**
 * Interfaz que todos los proveedores de meeting deben implementar
 */
export interface IMeetingProvider {
  /**
   * Crea un meeting en la plataforma
   * @param config - Configuración del meeting
   * @param tokenConfig - Configuración de tokens OAuth
   * @returns Información del meeting creado
   */
  createMeeting(config: MeetingConfig, tokenConfig: TokenConfig): Promise<MeetingInfo>;

  /**
   * Elimina/cancela un meeting de la plataforma
   * @param meetingId - ID del meeting a eliminar
   * @param tokenConfig - Configuración de tokens OAuth
   * @param userId - ID del usuario (para validación de permisos)
   */
  deleteMeeting(
    meetingId: string | number,
    tokenConfig: TokenConfig,
    userId?: string
  ): Promise<void>;

  /**
   * Valida y refresca el token si es necesario
   * @param tokenConfig - Configuración actual de tokens
   * @returns Token válido para usar
   */
  validateAndRefreshToken(tokenConfig: TokenConfig): Promise<string>;

  /**
   * Retorna el tipo de este proveedor
   * @returns Nombre del proveedor (zoom, teams, google_meet, etc.)
   */
  getProviderType(): string;

  /**
   * Verifica si el proveedor puede crear meetings para un usuario
   * @param userId - ID del usuario
   * @param tokenConfig - Configuración de tokens OAuth
   * @returns true si el usuario puede crear meetings
   */
  canCreateMeetings(userId: string, tokenConfig: TokenConfig): Promise<boolean>;

  /**
   * Obtiene información sobre un meeting existente (opcional)
   * @param meetingId - ID del meeting
   * @param tokenConfig - Configuración de tokens OAuth
   * @returns Información del meeting o null si no existe
   */
  getMeetingInfo?(
    meetingId: string | number,
    tokenConfig: TokenConfig
  ): Promise<MeetingInfo | null>;

  /**
   * Actualiza un meeting existente (opcional)
   * @param meetingId - ID del meeting a actualizar
   * @param config - Nueva configuración
   * @param tokenConfig - Configuración de tokens OAuth
   * @returns Información actualizada del meeting
   */
  updateMeeting?(
    meetingId: string | number,
    config: Partial<MeetingConfig>,
    tokenConfig: TokenConfig
  ): Promise<MeetingInfo>;
}