/**
 * 🎯 ESTRATEGIA: GOOGLE MEET + CALENDAR (TODO-EN-UNO)
 * 
 * Esta estrategia maneja la creación de meetings usando:
 * - Google Meet integrado con Google Calendar (en una sola operación)
 * 
 * Implementa la interfaz IMeetingStrategy.
 * PATRÓN: Más simple que otras estrategias porque Google Meet está integrado con Calendar
 */

import { AppDataSource } from "../../../config/database.config";
import {
  Integration,
} from "../../../database/entities/integration.entity";
import { IntegrationAppTypeEnum } from "../../../enums/integration.enum";
import { Event } from "../../../database/entities/event.entity";
import { Meeting, MeetingStatus } from "../../../database/entities/meeting.entity";
import { CreateMeetingDto } from "../../../database/dto/meeting.dto";
import {
  IMeetingStrategy,
  MeetingCreationResult,
  MeetingCancellationResult
} from "../interfaces/meeting-strategy.interface";
import { GoogleMeetProvider } from "../providers/google-meet.provider";
import { BadRequestException, NotFoundException } from "../../../utils/app-error";
import { convertUserTimezoneToUTC } from "../../../utils/timezone-helpers";

export class GoogleMeetCalendarStrategy implements IMeetingStrategy {

  constructor(
    private googleMeetProvider: GoogleMeetProvider
  ) { }

  /**
   * Crea un meeting usando Google Meet + Calendar integrado
   */
  async createMeeting(dto: CreateMeetingDto, timezone: string): Promise<MeetingCreationResult> {
    const { eventId, guestEmail, guestName, additionalInfo } = dto;
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    console.log('🎯 [GOOGLE_MEET_STRATEGY] Creating meeting:', {
      eventId,
      guestName,
      startTime,
      endTime,
      timezone
    });

    try {
      // PASO 1: Validar evento
      const event = await this.getAndValidateEvent(eventId);

      // PASO 2: Validar integraciones
      await this.validateIntegrations(event.user.id);

      // PASO 3: Obtener integración validada (solo necesitamos Google)
      const googleIntegration = await this.getValidatedGoogleIntegration(event.user.id);

      // PASO 4: Determinar calendar ID correcto
      const calendarId = this.determineCalendarId(event, googleIntegration);

      // PASO 5: Preparar configuración del meeting con los datos correctos
      const meetingConfig = {
        topic: `${guestName} - ${event.title}`,
        startTime,
        endTime,
        timezone,
        agenda: additionalInfo,
        userId: event.user.id,
        // Datos adicionales para el provider
        settings: {
          guestEmail: guestEmail,
          organizerEmail: event.user.email,
          calendarId: calendarId
        }
      };

      // PASO 6: Crear Google Meet + Calendar usando el provider todo-en-uno
      console.log('📅 [GOOGLE_MEET_STRATEGY] Step 6: Creating Google Meet + Calendar');
      const meetingInfo = await this.googleMeetProvider.createMeeting(meetingConfig, {
        accessToken: googleIntegration.access_token,
        refreshToken: googleIntegration.refresh_token,
        expiryDate: googleIntegration.expiry_date
      });

      const utcstartTime = convertUserTimezoneToUTC(new Date(dto.startTime), timezone);
      const utcendTime = convertUserTimezoneToUTC(new Date(dto.endTime), timezone);
      // PASO 7: Guardar en base de datos
      console.log('📅 [GOOGLE_MEET_STRATEGY] Step 7: Saving to database');
      const meeting = await this.saveMeetingToDatabase({
        event,
        guestName,
        guestEmail,
        additionalInfo,
        // startTime,
        // endTime,
        startTime:utcstartTime,
        endTime:utcendTime,
        meetLink: meetingInfo.joinUrl,
        calendarEventId: String(meetingInfo.id),
        calendarAppType: IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR,
        calendar_id: calendarId
      });

      const result: MeetingCreationResult = {
        meetLink: meetingInfo.joinUrl,
        meeting,
        calendarEventId: String(meetingInfo.id),
        meetingProviderId: String(meetingInfo.id),
        additionalData: {
          calendarProvider: 'google_calendar',
          meetingProvider: 'google_meet',
          hangoutLink: meetingInfo.additionalData?.hangoutLink,
          webLink: meetingInfo.additionalData?.webLink,
          googleCalendarId: calendarId
        }
      };

      console.log('✅ [GOOGLE_MEET_STRATEGY] Meeting created successfully:', {
        meetingId: meeting.id,
        googleEventId: meetingInfo.id,
        hangoutLink: meetingInfo.additionalData?.hangoutLink ? '✅' : '❌',
        calendarId: calendarId
      });

      return result;

    } catch (error) {
      console.error('❌ [GOOGLE_MEET_STRATEGY] Failed to create meeting:', {
        error: error instanceof Error ? error.message : String(error),
        eventId,
        guestName
      });
      throw error;
    }
  }

  /**
   * Cancela un meeting de Google Meet + Calendar
   */
  async cancelMeeting(meetingId: string): Promise<MeetingCancellationResult> {
    console.log('🗑️ [GOOGLE_MEET_STRATEGY] Cancelling meeting:', { meetingId });

    try {
      // PASO 1: Buscar meeting
      const meeting = await this.getMeetingById(meetingId);

      // PASO 2: Obtener integración validada
      const googleIntegration = await this.getValidatedGoogleIntegration(meeting.event.user.id);

      let meetingDeleted = false;
      const errors: string[] = [];

      // PASO 3: Cancelar Google Meet (eliminando el evento de Calendar)
      try {
        console.log('📅 [GOOGLE_MEET_STRATEGY] Cancelling Google Meet + Calendar event');

        const calendarIdForDeletion = this.determineCalendarIdForDeletion(meeting, googleIntegration);

        console.log('📅 [GOOGLE_MEET_STRATEGY] Calendar ID for deletion:', {
          meetingCalendarId: meeting.calendar_id,
          eventCalendarId: meeting.event.calendar_id,
          integrationCalendarId: googleIntegration.calendar_id,
          effective: calendarIdForDeletion
        });

        // Para Google Meet, el calendarEventId ES el meetingId
        await this.googleMeetProvider.deleteMeeting(
          meeting.calendarEventId, // Usar calendarEventId como meetingId
          {
            accessToken: googleIntegration.access_token,
            refreshToken: googleIntegration.refresh_token,
            expiryDate: googleIntegration.expiry_date
          },
          meeting.event.user.id,
          calendarIdForDeletion

        );

        meetingDeleted = true;
        console.log('✅ [GOOGLE_MEET_STRATEGY] Google Meet + Calendar cancelled');

      } catch (error) {
        const errorMsg = `Google Meet deletion failed: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.warn('⚠️ [GOOGLE_MEET_STRATEGY]', errorMsg);
        meetingDeleted = true; // Continuar de todas formas
      }

      // PASO 4: Actualizar estado en BD
      console.log('📅 [GOOGLE_MEET_STRATEGY] Updating database status');
      meeting.status = MeetingStatus.CANCELLED;
      await AppDataSource.getRepository(Meeting).save(meeting);

      const result: MeetingCancellationResult = {
        success: true,
        calendarDeleted: meetingDeleted, // Para Google Meet, calendar y meeting son lo mismo
        meetingDeleted: meetingDeleted,
        errors: errors.length > 0 ? errors : undefined,
        details: {
          calendarProvider: 'google_calendar',
          meetingProvider: 'google_meet',
          retryable: errors.length > 0
        }
      };

      console.log('✅ [GOOGLE_MEET_STRATEGY] Meeting cancelled successfully:', {
        meetingId,
        meetingDeleted,
        errorsCount: errors.length
      });

      return result;

    } catch (error) {
      console.error('❌ [GOOGLE_MEET_STRATEGY] Failed to cancel meeting:', {
        error: error instanceof Error ? error.message : String(error),
        meetingId
      });
      throw error;
    }
  }

  /**
   * Valida que todas las integraciones necesarias están disponibles
   */
  async validateIntegrations(userId: string): Promise<boolean> {
    console.log('🔍 [GOOGLE_MEET_STRATEGY] Validating integrations for user:', userId);

    try {
      const googleIntegration = await this.getValidatedGoogleIntegration(userId);

      // Validar token
      console.log('📅 [GOOGLE_MEET_STRATEGY] Validating Google token');
      await this.googleMeetProvider.validateAndRefreshToken({
        accessToken: googleIntegration.access_token,
        refreshToken: googleIntegration.refresh_token,
        expiryDate: googleIntegration.expiry_date
      });

      console.log('✅ [GOOGLE_MEET_STRATEGY] All integrations validated successfully');
      return true;

    } catch (error) {
      console.error('❌ [GOOGLE_MEET_STRATEGY] Integration validation failed:', error);
      throw new BadRequestException(
        `Integration validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Retorna el nombre de esta estrategia
   */
  getStrategyName(): string {
    return 'GoogleMeetCalendarStrategy';
  }

  // ============================================
  // 🔧 MÉTODOS HELPER PRIVADOS
  // ============================================

  private async getAndValidateEvent(eventId: string): Promise<Event> {
    const eventRepository = AppDataSource.getRepository(Event);

    const event = await eventRepository.findOne({
      where: { id: eventId, isPrivate: false },
      relations: ["user"],
    });

    if (!event) {
      throw new NotFoundException("Event not found or is private");
    }

    return event;
  }

  private async getMeetingById(meetingId: string): Promise<Meeting> {
    const meetingRepository = AppDataSource.getRepository(Meeting);

    const meeting = await meetingRepository.findOne({
      where: { id: meetingId },
      relations: ["event", "event.user"],
    });

    if (!meeting) {
      throw new NotFoundException("Meeting not found");
    }

    return meeting;
  }

  private async getGoogleIntegration(userId: string): Promise<Integration | null> {
    const integrationRepository = AppDataSource.getRepository(Integration);

    return await integrationRepository.findOne({
      where: { user: { id: userId }, app_type: IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR }
    });
  }

  /**
   * Obtiene integración de Google validada (garantiza que no es null)
   */
  private async getValidatedGoogleIntegration(userId: string): Promise<Integration> {
    const googleIntegration = await this.getGoogleIntegration(userId);

    if (!googleIntegration) {
      throw new BadRequestException("Google Calendar + Meet integration not found. Please connect your Google account.");
    }

    return googleIntegration;
  }

  private determineCalendarId(event: Event, googleIntegration: Integration): string {
    // Prioridad: calendar_id del evento > calendar_id de la integración > 'primary'
    return event.calendar_id ||
      googleIntegration.calendar_id ||
      'primary';
  }

  private determineCalendarIdForDeletion(meeting: Meeting, googleIntegration: Integration): string {
    // Prioridad: calendar_id del meeting > calendar_id del evento > calendar_id de la integración > 'primary'
    return meeting.calendar_id ||
      meeting.event.calendar_id ||
      googleIntegration.calendar_id ||
      'primary';
  }

  // 🔧 FIX: Método saveMeetingToDatabase corregido
  private async saveMeetingToDatabase(data: {
    event: Event;
    guestName: string;
    guestEmail: string;
    additionalInfo?: string;
    startTime: Date;
    endTime: Date;
    meetLink: string;
    calendarEventId: string;
    calendarAppType: IntegrationAppTypeEnum;
    calendar_id: string;
  }): Promise<Meeting> {
    const meetingRepository = AppDataSource.getRepository(Meeting);

    // 🔧 FIX: Crear la entidad correctamente
    const meeting = new Meeting();
    meeting.event = data.event;
    meeting.user = data.event.user;
    meeting.guestName = data.guestName;
    meeting.guestEmail = data.guestEmail;
    meeting.additionalInfo = data.additionalInfo || '';
    meeting.startTime = data.startTime;
    meeting.endTime = data.endTime;
    meeting.meetLink = data.meetLink;
    meeting.calendarEventId = data.calendarEventId;
    meeting.calendarAppType = data.calendarAppType;
    meeting.calendar_id = data.calendar_id;
    // Para Google Meet NO hay zoom_meeting_id (debe ser undefined, no null)
    meeting.zoom_meeting_id = undefined; // 🔧 FIX: undefined en lugar de null
    meeting.zoom_join_url = undefined;   // 🔧 FIX: undefined en lugar de null
    meeting.zoom_start_url = undefined;  // 🔧 FIX: undefined en lugar de null
    meeting.status = MeetingStatus.SCHEDULED;

    // 🔧 FIX: Guardar y retornar correctamente
    return await meetingRepository.save(meeting);
  }
}