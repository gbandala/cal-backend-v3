// src/@types/calendar-event.type.ts
/**
 * INTERFAZ PARA EVENTOS DE CALENDARIO
 * 
 * Define la estructura estándar para eventos obtenidos de diferentes
 * proveedores de calendario (Google, Outlook, etc.)
 */

export interface CalendarEvent {
  /** ID único del evento en el proveedor */
  id: string;
  
  /** Título/asunto del evento */
  title: string;
  
  /** Fecha y hora de inicio (en UTC) */
  startTime: Date;
  
  /** Fecha y hora de fin (en UTC) */
  endTime: Date;
  
  /** Indica si es un evento de todo el día */
  isAllDay: boolean;
  
  /** Estado del evento */
  status?: 'confirmed' | 'cancelled' | 'tentative';
  
  /** Organizador del evento */
  organizer?: {
    email: string;
    name?: string;
  };
  
  /** Asistentes del evento */
  attendees?: Array<{
    email: string;
    name?: string;
    responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
  
  /** Descripción opcional del evento */
  description?: string;
  
  /** Ubicación del evento */
  location?: string;
  
  /** Si es un evento recurrente */
  isRecurring?: boolean;
  
  /** Zona horaria original del evento */
  timeZone?: string;
  
  /** Datos específicos del proveedor */
  providerData?: {
    provider: 'google' | 'outlook';
    originalEvent: any;
  };
}

/**
 * Parámetros para consultar eventos de calendario
 */
export interface CalendarEventsQuery {
  /** ID del calendario a consultar */
  calendarId: string;
  
  /** Fecha en formato YYYY-MM-DD */
  date: string;
  
  /** Zona horaria para la consulta */
  timezone: string;
  
  /** Incluir eventos de todo el día */
  includeAllDay?: boolean;
  
  /** Incluir eventos cancelados */
  includeCancelled?: boolean;
  
  /** Máximo número de eventos a retornar */
  maxResults?: number;
}

/**
 * Resultado de la consulta de eventos
 */
export interface CalendarEventsResult {
  /** Eventos encontrados */
  events: CalendarEvent[];
  
  /** Total de eventos (puede ser mayor que events.length si hay paginación) */
  totalCount: number;
  
  /** Proveedor consultado */
  provider: 'google' | 'outlook';
  
  /** Calendar ID consultado */
  calendarId: string;
  
  /** Fecha consultada */
  date: string;
  
  /** Si hubo errores durante la consulta */
  hasErrors: boolean;
  
  /** Errores encontrados */
  errors?: string[];
}