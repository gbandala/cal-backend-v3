/**
 * 📅 OUTLOOK CALENDAR PROVIDER
 * 
 * Este provider maneja todas las operaciones de Outlook Calendar API.
 * Implementa la interfaz ICalendarProvider para operaciones estándar.
 */

import {
  ICalendarProvider,
  CalendarEvent,
  TokenConfig,
  CalendarOperationResult
} from "../../interfaces/calendar-provider.interface";
import {
  validateMicrosoftToken,
  createOutlookEvent,
  deleteOutlookEvent
} from "../../../outlook.service";
import { BadRequestException } from "../../../../utils/app-error";

export class OutlookCalendarProvider implements ICalendarProvider {

  /**
   * Crea un evento en Outlook Calendar
   */
  async createEvent(
    calendarId: string,
    event: CalendarEvent,
    tokenConfig: TokenConfig
  ): Promise<string> {
    const validCalendarId = this.normalizeCalendarId(calendarId);

    console.log('📅 [OUTLOOK_CALENDAR] Creating event:', {
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

      // 2. Crear evento usando el servicio existente de Outlook
      const outlookEvent = await createOutlookEvent(validToken, calendarId, {
        title: event.title,
        description: event.description || '',
        startTime: event.startTime,
        endTime: event.endTime,
        timezone: event.timezone,
        attendeeEmail: event.attendees[0], // Principal invitado
        organizerEmail: event.attendees[1], // Organizador
        zoomJoinUrl: event.meetingUrl // URL del meeting si existe
      });

      console.log('✅ [OUTLOOK_CALENDAR] Event created successfully:', {
        eventId: outlookEvent.id,
        calendarId: validCalendarId,
      });

      return outlookEvent.id;

    } catch (error) {
      console.error('❌ [OUTLOOK_CALENDAR] Failed to create event:', {
        error: error instanceof Error ? error.message : String(error),
        calendarId,
        validCalendarId,
        eventTitle: event.title
      });

      throw new BadRequestException(
        `Failed to create Outlook Calendar event: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }


  // ✅ AGREGAR ESTE MÉTODO HELPER AL FINAL DE LA CLASE
  /**
   * Normaliza el calendar ID para Microsoft Graph API
   */
  private normalizeCalendarId(calendarId: string): string {
    // Microsoft Graph acepta:
    // - 'primary' para calendario principal
    // - IDs específicos de calendarios
    // - Para IDs no válidos, usar 'primary' como fallback

    if (!calendarId ||
      calendarId === 'primary' ||
      calendarId.includes('fallback') ||
      calendarId === 'consultorias' ||
      calendarId.length < 10) {
      console.log('📅 [OUTLOOK_CALENDAR] Using primary calendar as fallback for:', calendarId);
      return 'primary';
    }

    // Si parece un ID válido de Outlook (generalmente son UUIDs o strings largos)
    if (calendarId.length > 20 || calendarId.includes('-')) {
      return calendarId;
    }

    // Fallback seguro
    console.log('📅 [OUTLOOK_CALENDAR] Using primary calendar as safe fallback for:', calendarId);
    return 'primary';
  }

  /**
   * Elimina un evento de Outlook Calendar
   */
  async deleteEvent(
    calendarId: string,
    eventId: string,
    tokenConfig: TokenConfig
  ): Promise<void> {
    console.log('🗑️ [OUTLOOK_CALENDAR] Deleting event:', {
      calendarId,
      eventId
    });

    try {
      // 1. Validar y refrescar token
      const validToken = await this.validateAndRefreshToken(tokenConfig);

      // 2. Eliminar evento usando el servicio existente de Outlook
      await deleteOutlookEvent(validToken, eventId);

      console.log('✅ [OUTLOOK_CALENDAR] Event deleted successfully:', {
        eventId,
        calendarId
      });

    } catch (error) {
      console.error('❌ [OUTLOOK_CALENDAR] Failed to delete event:', {
        error: error instanceof Error ? error.message : String(error),
        calendarId,
        eventId
      });

      // Para eliminación, ser más permisivo - podría ya estar eliminado
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes('not found') ||
        errorMessage.toLowerCase().includes('does not exist')) {
        console.log('ℹ️ [OUTLOOK_CALENDAR] Event already deleted or not found - continuing');
        return;
      }

      throw new BadRequestException(
        `Failed to delete Outlook Calendar event: ${errorMessage}`
      );
    }
  }

  /**
   * Valida y refresca el token de Microsoft
   */
  async validateAndRefreshToken(tokenConfig: TokenConfig): Promise<string> {
    try {
      return await validateMicrosoftToken(
        tokenConfig.accessToken,
        tokenConfig.refreshToken,
        tokenConfig.expiryDate
      );
    } catch (error) {
      console.error('❌ [OUTLOOK_CALENDAR] Token validation failed:', error);
      throw new BadRequestException(
        `Microsoft token validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Retorna el tipo de este proveedor
   */
  getProviderType(): string {
    return 'outlook_calendar';
  }

  /**
   * Verifica si puede manejar un calendar ID específico
   * Para Outlook, acepta 'primary' o IDs específicos de calendarios
   */
  canHandleCalendar(calendarId: string): boolean {
    // Outlook acepta 'primary' o IDs específicos
    return calendarId === 'primary' ||
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

      // 🚀 TODO: Implementar llamada a Microsoft Graph API para obtener info del calendario
      // Por ahora retornamos info básica
      return {
        name: calendarId === 'primary' ? 'Primary Calendar' : `Calendar ${calendarId}`,
        timezone: 'America/Mexico_City', // Por defecto
        isWritable: true // Asumimos que tiene permisos de escritura
      };

    } catch (error) {
      console.warn('⚠️ [OUTLOOK_CALENDAR] Could not get calendar info:', error);
      return null;
    }
  }

  // ============================================
  // 🔧 MÉTODOS HELPER ADICIONALES
  // ============================================

  /**
   * Formatea un CalendarEvent para Outlook API
   */
  private formatEventForOutlook(event: CalendarEvent) {
    return {
      subject: event.title,
      body: {
        contentType: 'HTML',
        content: this.buildEventDescription(event)
      },
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: event.timezone
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: event.timezone
      },
      attendees: event.attendees.map(email => ({
        emailAddress: {
          address: email,
          name: email.split('@')[0] // Usar parte antes del @ como nombre
        },
        type: 'required'
      })),
      isOnlineMeeting: !!event.meetingUrl,
      onlineMeetingUrl: event.meetingUrl,
      location: event.providerSpecific?.location ? {
        displayName: event.providerSpecific.location
      } : undefined,
      reminderMinutesBeforeStart: event.providerSpecific?.reminderMinutes?.[0] || 15
    };
  }

  /**
   * Construye la descripción del evento incluyendo meeting URL
   */
  private buildEventDescription(event: CalendarEvent): string {
    let description = event.description || '';

    if (event.meetingUrl) {
      description += `\n\n🎥 Join Meeting: <a href="${event.meetingUrl}">${event.meetingUrl}</a>`;
    }

    return description;
  }

  /**
   * Verifica si un error de Outlook indica que el evento no existe
   */
  private isEventNotFoundError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const notFoundIndicators = [
      'not found',
      'does not exist',
      'item not found',
      'event not found',
      '404'
    ];

    return notFoundIndicators.some(indicator =>
      errorMessage.toLowerCase().includes(indicator)
    );
  }
}