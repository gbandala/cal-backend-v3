/**
 * 🎥 GOOGLE MEET PROVIDER (TODO-EN-UNO) - CALENDAR ID FIXED
 * 
 * Este provider maneja TANTO Google Meet COMO Google Calendar en una operación,
 * ya que Google Meet está intrínsecamente integrado con Google Calendar.
 * 
 * Implementa IMeetingProvider pero internamente maneja también el calendario.
 * 
 * 🔧 FIX: Corregido el problema del calendar ID en eliminación
 * PATRÓN: Opción A - Todo-en-uno (recomendado para Google Meet)
 */

import { 
  IMeetingProvider, 
  MeetingConfig, 
  MeetingInfo,   
} from "../interfaces/meeting-provider.interface";
import { TokenConfig } from "../interfaces/calendar-provider.interface";
import { 
  validateGoogleCalendarToken, 
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  normalizeGoogleCalendarId
} from "../../google.service";
import { BadRequestException } from "../../../utils/app-error";

export class GoogleMeetProvider implements IMeetingProvider {

  /**
   * Crea un Google Meet integrado con Google Calendar
   * NOTA: Google Meet se crea automáticamente al crear el evento de Calendar con conferenceData
   */
  async createMeeting(config: MeetingConfig, tokenConfig: TokenConfig): Promise<MeetingInfo> {
    console.log('🎥 [GOOGLE_MEET] Creating Google Meet + Calendar event:', {
      topic: config.topic,
      startTime: config.startTime,
      endTime: config.endTime,
      timezone: config.timezone
    });

    try {
      // 1. Validar y refrescar token
      const validToken = await this.validateAndRefreshToken(tokenConfig);

      // 2. Determinar calendar ID (puede venir en config.userId como referencia)
      const calendarId = this.determineCalendarId(config);

      // 3. Preparar datos del evento CON Google Meet automático
      const eventData = this.prepareEventData(config);

      // 4. Crear evento de Google Calendar CON Google Meet integrado
      // El google.service.ts ya maneja conferenceData automáticamente cuando NO hay zoomJoinUrl
      const googleEvent = await createGoogleCalendarEvent(validToken, calendarId, eventData);

      // 5. Validar que se generó el Google Meet
      if (!googleEvent.hangoutLink) {
        console.warn('⚠️ [GOOGLE_MEET] No hangoutLink generated, might be configuration issue');
      }

      const meetingInfo: MeetingInfo = {
        id: googleEvent.id,
        joinUrl: googleEvent.hangoutLink || googleEvent.webLink, // Fallback a webLink si no hay hangoutLink
        // startUrl no existe en Google Meet (solo el joinUrl para todos)
        additionalData: {
          calendarEventId: googleEvent.id,
          webLink: googleEvent.webLink,
          hangoutLink: googleEvent.hangoutLink,
          calendarProvider: 'google_calendar',
          meetingProvider: 'google_meet',
          // 🔧 FIX: Guardar el calendar ID usado para la eliminación
          calendarIdUsed: calendarId
        }
      };

      console.log('✅ [GOOGLE_MEET] Google Meet + Calendar created successfully:', {
        eventId: meetingInfo.id,
        hasHangoutLink: !!googleEvent.hangoutLink,
        webLink: googleEvent.webLink ? '✅' : '❌',
        calendarId: calendarId // 🔧 FIX: Log del calendar ID usado
      });

      return meetingInfo;

    } catch (error) {
      console.error('❌ [GOOGLE_MEET] Failed to create Google Meet:', {
        error: error instanceof Error ? error.message : String(error),
        topic: config.topic
      });
      
      throw new BadRequestException(
        `Failed to create Google Meet: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 🔧 FIX: Elimina el Google Meet (eliminando el evento de Calendar)
   * NOTA: Al eliminar el evento, automáticamente se elimina el Google Meet asociado
   */
  async deleteMeeting(
    meetingId: string | number, 
    tokenConfig: TokenConfig, 
    userId?: string,
    calendarId?: string // 🔧 FIX: Nuevo parámetro opcional para calendar ID
  ): Promise<void> {
    console.log('🗑️ [GOOGLE_MEET] Deleting Google Meet (calendar event):', {
      meetingId,
      userId,
      calendarId // 🔧 FIX: Log del calendar ID recibido
    });

    try {
      // 1. Validar y refrescar token
      const validToken = await this.validateAndRefreshToken(tokenConfig);

      // 2. Determinar calendar ID - PRIORIZAR el parámetro recibido
      const effectiveCalendarId = this.determineCalendarIdForDeletion(calendarId, userId);
      
      console.log('📅 [GOOGLE_MEET] Using calendar ID for deletion:', {
        received: calendarId,
        effective: effectiveCalendarId,
        meetingId
      });

      // 3. Eliminar evento de Google Calendar (automáticamente elimina el Meet)
      await deleteGoogleCalendarEvent(
        validToken, 
        effectiveCalendarId, 
        meetingId.toString()
      );

      console.log('✅ [GOOGLE_MEET] Google Meet deleted successfully (via calendar event):', {
        meetingId,
        calendarId: effectiveCalendarId
      });

    } catch (error) {
      console.error('❌ [GOOGLE_MEET] Failed to delete Google Meet:', {
        error: error instanceof Error ? error.message : String(error),
        meetingId,
        calendarId,
        effectiveCalendarId: this.determineCalendarIdForDeletion(calendarId, userId)
      });

      // Ser permisivo con ciertos errores - el evento podría ya estar eliminado
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.isEventNotFoundError(errorMessage)) {
        console.log('ℹ️ [GOOGLE_MEET] Event already deleted or not found - continuing');
        return;
      }

      throw error; // Re-lanzar si no es un error de "not found"
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
      console.error('❌ [GOOGLE_MEET] Token validation failed:', error);
      throw new BadRequestException(
        `Google token validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Retorna el tipo de este proveedor
   */
  getProviderType(): string {
    return 'google_meet';
  }

  /**
   * Verifica si el usuario puede crear meetings
   */
  async canCreateMeetings(userId: string, tokenConfig: TokenConfig): Promise<boolean> {
    try {
      // Intentar validar token como prueba básica
      await this.validateAndRefreshToken(tokenConfig);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene información de un meeting existente (implementación opcional)
   * NOTA: Para Google Meet, esto requeriría obtener el evento de Calendar
   */
  async getMeetingInfo(
    meetingId: string | number, 
    tokenConfig: TokenConfig
  ): Promise<MeetingInfo | null> {
    try {
      // 🚀 TODO: Implementar si es necesario
      // Requeriría obtener el evento de Google Calendar por ID
      console.warn('⚠️ [GOOGLE_MEET] getMeetingInfo not implemented yet');
      return null;

    } catch (error) {
      console.warn('⚠️ [GOOGLE_MEET] Could not get meeting info:', error);
      return null;
    }
  }

  // ============================================
  // 🔧 MÉTODOS HELPER PRIVADOS
  // ============================================

  /**
   * Prepara los datos del evento para Google Calendar con Google Meet automático
   */
  private prepareEventData(config: MeetingConfig) {
    // Extraer emails de los settings que pasa la estrategia
    const guestEmail = config.settings?.guestEmail || 'guest@example.com';
    const organizerEmail = config.settings?.organizerEmail || 'organizer@example.com';
    
    return {
      title: config.topic,
      description: config.agenda || '',
      startTime: config.startTime,
      endTime: config.endTime,
      timezone: config.timezone,
      attendeeEmail: guestEmail,
      organizerEmail: organizerEmail,
      // NO incluir zoomJoinUrl para que google.service.ts automáticamente genere Google Meet
    };
  }

  /**
   * Determina el calendar ID a usar para crear el evento
   */
  private determineCalendarId(config: MeetingConfig): string {
    // Usar calendarId de los settings que pasa la estrategia, o 'primary' por defecto
    const calendarId = config.settings?.calendarId || 'primary';
    return normalizeGoogleCalendarId(calendarId);
  }

  /**
   * 🔧 FIX: Determina el calendar ID para eliminar evento
   * PRIORIDAD: calendarId recibido > calendar ID de creación > primary
   */
  private determineCalendarIdForDeletion(calendarId?: string, userId?: string): string {
    console.log('🔍 [GOOGLE_MEET] Determining calendar ID for deletion:', {
      calendarIdParam: calendarId,
      userId
    });

    // 1. Si se especifica calendar ID, usarlo
    if (calendarId && calendarId !== 'undefined' && calendarId.trim() !== '') {
      const normalized = normalizeGoogleCalendarId(calendarId);
      console.log('✅ [GOOGLE_MEET] Using specified calendar ID:', normalized);
      return normalized;
    }

    // 2. Fallback a 'primary' 
    const fallback = normalizeGoogleCalendarId('primary');
    console.log('⚠️ [GOOGLE_MEET] Using fallback calendar ID:', fallback);
    return fallback;
  }

  /**
   * Verifica si un error indica que el evento no existe
   */
  private isEventNotFoundError(errorMessage: string): boolean {
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

  // ============================================
  // 🔧 MÉTODOS ADICIONALES ESPECÍFICOS DE GOOGLE MEET
  // ============================================

  /**
   * Actualiza configuración de un Google Meet existente (opcional)
   * NOTA: Para Google Meet, esto requeriría actualizar el evento de Calendar
   */
  async updateMeetingSettings(
    meetingId: string | number,
    settings: any,
    tokenConfig: TokenConfig
  ): Promise<void> {
    // 🚀 TODO: Implementar si es necesario
    console.warn('⚠️ [GOOGLE_MEET] updateMeetingSettings not implemented yet');
  }

  /**
   * Obtiene configuraciones específicas de Google Meet
   */
  getDefaultMeetingSettings() {
    return {
      // Google Meet no tiene configuraciones como Zoom
      // Se controla principalmente desde la configuración de Google Calendar
      autoGenerateMeetLink: true,
      allowExternalAttendees: true
    };
  }
}