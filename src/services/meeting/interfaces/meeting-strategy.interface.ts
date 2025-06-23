/**
 * 🎯 INTERFAZ PRINCIPAL PARA ESTRATEGIAS DE MEETING
 * 
 * Esta interfaz define el contrato que todas las estrategias de meeting deben cumplir.
 * Cada combinación (Google Meet + Calendar, Zoom + Outlook, etc.) implementará esta interfaz.
 */

import { CreateMeetingDto } from "../../../database/dto/meeting.dto";
import { Meeting } from "../../../database/entities/meeting.entity";

/**
 * Resultado de la creación de un meeting
 */
export interface MeetingCreationResult {

  meetLink: string; /** Link principal para unirse al meeting (Zoom, Teams, Meet, etc.) */
  meeting: Meeting;
  calendarEventId: string;
  meetingProviderId?: string | number;    /** ID del meeting en la plataforma (Zoom meeting ID, Teams meeting ID, etc.) */
  additionalData?: {
    zoomStartUrl?: string;
    teamsJoinUrl?: string;
    calendarProvider?: string;
    meetingProvider?: string;
    [key: string]: any;
  };
}

/**
 * Resultado de la cancelación de un meeting
 */
export interface MeetingCancellationResult {
  success: boolean;
  calendarDeleted: boolean;
  meetingDeleted: boolean;
  errors?: string[];
  details?: {
    calendarProvider?: string;
    meetingProvider?: string;
    retryable?: boolean;
  };
}

/**
 * Interfaz principal que todas las estrategias deben implementar
 */
export interface IMeetingStrategy {
  /**
   * Crea un meeting usando esta estrategia específica
   * @param dto - Datos del meeting a crear
   * @param timezone - Zona horaria para el meeting
   * @returns Resultado con todos los datos del meeting creado
   */
  createMeeting(dto: CreateMeetingDto, timezone: string): Promise<MeetingCreationResult>;

  /**
   * Cancela un meeting usando esta estrategia específica
   * @param meetingId - ID del meeting a cancelar
   * @returns Resultado de la cancelación
   */
  cancelMeeting(meetingId: string): Promise<MeetingCancellationResult>;

  /**
   * Valida que todas las integraciones necesarias están disponibles y funcionando
   * @param userId - ID del usuario propietario del evento
   * @returns true si todas las integraciones están listas
   * @throws BadRequestException si alguna integración falta o tiene problemas
   */
  validateIntegrations(userId: string): Promise<boolean>;

  /**
   * Retorna el nombre de esta estrategia (para logging y debugging)
   */
  getStrategyName(): string;
}