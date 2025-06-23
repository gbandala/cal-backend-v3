/**
 * 📅 INTERFAZ PARA PROVEEDORES DE CALENDARIO
 * 
 * Esta interfaz abstrae las operaciones de calendario (Google Calendar, Outlook Calendar, etc.)
 * Cada proveedor de calendario implementa esta interfaz.
 */

/**
 * Datos de un evento de calendario
 */
export interface CalendarEvent {
  /** ID del evento (se genera automáticamente en creación) */
  id: string;    
  title: string;    
  description?: string;   
  startTime: Date;    
  endTime: Date;    
  timezone: string;    
  attendees: string[];  
  meetingUrl?: string;   
  providerSpecific?: {
    location?: string;
    isOnlineMeeting?: boolean;
    reminderMinutes?: number[];
    recurrence?: any;
    [key: string]: any;
  };
}

/**
 * Configuración de token para proveedores OAuth
 */
export interface TokenConfig {
  accessToken: string;
  refreshToken: string;
  expiryDate: number | null;
}

/**
 * Resultado de operaciones de calendario
 */
export interface CalendarOperationResult {
  success: boolean;
  eventId?: string;
  error?: string;
  providerResponse?: any;
}

/**
 * Interfaz que todos los proveedores de calendario deben implementar
 */
export interface ICalendarProvider {
  /**
   * Crea un evento en el calendario especificado
   * @param calendarId - ID del calendario donde crear el evento
   * @param event - Datos del evento a crear
   * @param tokenConfig - Configuración de tokens OAuth
   * @returns ID del evento creado
   */
  createEvent(
    calendarId: string, 
    event: CalendarEvent, 
    tokenConfig: TokenConfig
  ): Promise<string>;
  
  /**
   * Elimina un evento del calendario especificado
   * @param calendarId - ID del calendario
   * @param eventId - ID del evento a eliminar
   * @param tokenConfig - Configuración de tokens OAuth
   */
  deleteEvent(
    calendarId: string, 
    eventId: string, 
    tokenConfig: TokenConfig
  ): Promise<void>;
  
  /**
   * Valida y refresca el token si es necesario
   * @param tokenConfig - Configuración actual de tokens
   * @returns Token válido para usar
   */
  validateAndRefreshToken(tokenConfig: TokenConfig): Promise<string>;
  
  /**
   * Retorna el tipo de este proveedor
   * @returns Nombre del proveedor (google_calendar, outlook_calendar, etc.)
   */
  getProviderType(): string;
  
  /**
   * Verifica si el proveedor puede manejar un calendar ID específico
   * @param calendarId - ID del calendario a verificar
   * @returns true si este proveedor puede manejar este calendar
   */
  canHandleCalendar(calendarId: string): boolean;
  
  /**
   * Obtiene información sobre el calendario (opcional)
   * @param calendarId - ID del calendario
   * @param tokenConfig - Configuración de tokens OAuth
   * @returns Información del calendario o null si no está disponible
   */
  getCalendarInfo?(calendarId: string, tokenConfig: TokenConfig): Promise<{
    name: string;
    timezone: string;
    isWritable: boolean;
  } | null>;
}