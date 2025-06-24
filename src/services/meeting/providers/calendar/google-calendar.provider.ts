/**
 * 📅 GOOGLE CALENDAR PROVIDER
 * 
 * Este provider maneja todas las operaciones de Google Calendar API.
 * Implementa la interfaz ICalendarProvider para operaciones estándar.
 * 
 * PATRÓN: Copia exacta de OutlookCalendarProvider adaptada para Google Calendar
 */

import {
  ICalendarProvider,
  CalendarEvent,
  TokenConfig
} from "../../interfaces/calendar-provider.interface";
import {
  validateGoogleCalendarToken,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  normalizeGoogleCalendarId
} from "../../../google.service";
import { BadRequestException } from "../../../../utils/app-error";

export class GoogleCalendarProvider implements ICalendarProvider {

  /**
   * Crea un evento en Google Calendar
   */
  async createEvent(
    calendarId: string,
    event: CalendarEvent,
    tokenConfig: TokenConfig
  ): Promise<string> {
    const validCalendarId = normalizeGoogleCalendarId(calendarId);

    console.log('📅 [GOOGLE_CALENDAR] Creating event:', {
      calendarId,
      validCalendarId,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      attendees: event.attendees.length
    });

    try {
      // 1. Validar y refrescar token
      const validToken = await this.validateAndRefreshToken(tokenConfig);

      // 2. Crear evento usando el servicio de Google Calendar
      const googleEvent = await createGoogleCalendarEvent(validToken, validCalendarId, {
        title: event.title,
        description: event.description || '',
        startTime: event.startTime,
        endTime: event.endTime,
        timezone: event.timezone,
        attendeeEmail: event.attendees[0], // Principal invitado
        organizerEmail: event.attendees[1], // Organizador
        zoomJoinUrl: event.meetingUrl // URL del meeting si existe
      });

      console.log('✅ [GOOGLE_CALENDAR] Event created successfully:', googleEvent);

      return googleEvent.id;

    } catch (error) {
      console.error('❌ [GOOGLE_CALENDAR] Failed to create event:', {
        error: error instanceof Error ? error.message : String(error),
        calendarId,
        validCalendarId,
        eventTitle: event.title
      });

      throw new BadRequestException(
        `Failed to create Google Calendar event: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Normaliza el calendar ID para Google Calendar API
   */
  private normalizeCalendarId(calendarId: string): string {
    // Google Calendar acepta:
    // - 'primary' para calendario principal
    // - IDs específicos de calendarios
    // - Email addresses como calendar IDs

    if (!calendarId ||
      calendarId === 'primary' ||
      calendarId.includes('fallback') ||
      calendarId === 'consultorias' ||
      calendarId.length < 10) {
      console.log('📅 [GOOGLE_CALENDAR] Using primary calendar as fallback for:', calendarId);
      return 'primary';
    }

    // Si parece un email o un ID válido de Google Calendar
    if (calendarId.includes('@') || calendarId.includes('.') || calendarId.length > 20) {
      return calendarId;
    }

    // Fallback seguro
    console.log('📅 [GOOGLE_CALENDAR] Using primary calendar as safe fallback for:', calendarId);
    return 'primary';
  }

  /**
   * Elimina un evento de Google Calendar
   */
  async deleteEvent(
    calendarId: string,
    eventId: string,
    tokenConfig: TokenConfig
  ): Promise<void> {
    console.log('🗑️ [GOOGLE_CALENDAR] Deleting event:', {
      calendarId,
      eventId
    });

    try {
      // 1. Validar y refrescar token
      const validToken = await this.validateAndRefreshToken(tokenConfig);

      // 2. Normalizar calendar ID
      const validCalendarId = normalizeGoogleCalendarId(calendarId);

      // 3. Eliminar evento usando el servicio de Google Calendar
      await deleteGoogleCalendarEvent(validToken, validCalendarId, eventId);

      console.log('✅ [GOOGLE_CALENDAR] Event deleted successfully:', {
        eventId,
        calendarId: validCalendarId
      });

    } catch (error) {
      console.error('❌ [GOOGLE_CALENDAR] Failed to delete event:', {
        error: error instanceof Error ? error.message : String(error),
        calendarId,
        eventId
      });

      // Para eliminación, ser más permisivo - podría ya estar eliminado
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes('not found') ||
        errorMessage.toLowerCase().includes('does not exist')) {
        console.log('ℹ️ [GOOGLE_CALENDAR] Event already deleted or not found - continuing');
        return;
      }

      throw new BadRequestException(
        `Failed to delete Google Calendar event: ${errorMessage}`
      );
    }
  }

  /**
   * Valida y refresca el token de Google
   */
  async validateAndRefreshToken(tokenConfig: TokenConfig): Promise<string> {
    try {
      return await validateGoogleCalendarToken(
        tokenConfig.accessToken,
        tokenConfig.refreshToken,
        tokenConfig.expiryDate
      );
    } catch (error) {
      console.error('❌ [GOOGLE_CALENDAR] Token validation failed:', error);
      throw new BadRequestException(
        `Google token validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Retorna el tipo de este proveedor
   */
  getProviderType(): string {
    return 'google_calendar';
  }

  /**
   * Verifica si puede manejar un calendar ID específico
   * Para Google Calendar, acepta 'primary', emails o IDs específicos
   */
  canHandleCalendar(calendarId: string): boolean {
    // Google Calendar acepta 'primary', emails o IDs específicos
    return calendarId === 'primary' ||
      calendarId.includes('@') ||
      calendarId.length > 0; // Cualquier ID no vacío
  }

  /**
   * Obtiene información del calendario (implementación opcional)
   */
  async getCalendarInfo(
    calendarId: string,
    tokenConfig: TokenConfig
  ): Promise<{ name: string; timezone: string; isWritable: boolean; } | null> {
    try {
      const validToken = await this.validateAndRefreshToken(tokenConfig);

      // 🚀 TODO: Implementar llamada a Google Calendar API para obtener info del calendario
      // Por ahora retornamos info básica
      return {
        name: calendarId === 'primary' ? 'Primary Calendar' : `Calendar ${calendarId}`,
        timezone: 'America/Mexico_City', // Por defecto
        isWritable: true // Asumimos que tiene permisos de escritura
      };

    } catch (error) {
      console.warn('⚠️ [GOOGLE_CALENDAR] Could not get calendar info:', error);
      return null;
    }
  }

  // ============================================
  // 🔧 MÉTODOS HELPER ADICIONALES
  // ============================================

  /**
   * Formatea un CalendarEvent para Google Calendar API
   */
  private formatEventForGoogle(event: CalendarEvent) {
    return {
      summary: event.title,
      description: this.buildEventDescription(event),
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: event.timezone
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: event.timezone
      },
      attendees: event.attendees.map(email => ({
        email: email,
        displayName: email.split('@')[0] // Usar parte antes del @ como nombre
      })),
      location: event.providerSpecific?.location,
      reminders: {
        useDefault: false,
        overrides: event.providerSpecific?.reminderMinutes?.map(minutes => ({
          method: 'popup',
          minutes: minutes
        })) || [{ method: 'popup', minutes: 15 }]
      },
      // Añadir URL del meeting si existe
      ...(event.meetingUrl && {
        conferenceData: {
          conferenceSolution: {
            name: 'Zoom',
            iconUri: 'https://zoom.us/favicon.ico'
          },
          conferenceId: event.meetingUrl.split('/').pop(),
          entryPoints: [{
            entryPointType: 'video',
            uri: event.meetingUrl,
            label: 'Join Zoom Meeting'
          }]
        }
      })
    };
  }

  /**
   * Construye la descripción del evento incluyendo meeting URL
   */
  private buildEventDescription(event: CalendarEvent): string {
    let description = event.description || '';

    if (event.meetingUrl) {
      description += `\n\n🎥 Join Meeting: ${event.meetingUrl}`;
    }

    return description;
  }

  /**
   * Verifica si un error de Google Calendar indica que el evento no existe
   */
  private isEventNotFoundError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const notFoundIndicators = [
      'not found',
      'does not exist',
      'event not found',
      'resource not found',
      '404'
    ];

    return notFoundIndicators.some(indicator =>
      errorMessage.toLowerCase().includes(indicator)
    );
  }
}