/**
 * 🎯 ESTRATEGIA: ZOOM + OUTLOOK CALENDAR
 * 
 * Esta estrategia maneja la creación de meetings usando:
 * - Zoom para videoconferencias
 * - Outlook Calendar para tracking de eventos
 * 
 * Implementa la interfaz IMeetingStrategy.
 */

import { AppDataSource } from "../../../config/database.config";
import { 
  Integration, 
  // IntegrationAppTypeEnum 
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
import { ZoomMeetingProvider } from  "../../../services/meeting/providers/zoom.provider";
import { OutlookCalendarProvider } from "../providers/calendar/outlook-calendar.provider";
import { BadRequestException, NotFoundException } from "../../../utils/app-error";

export class ZoomOutlookCalendarStrategy implements IMeetingStrategy {
  
  constructor(
    private zoomProvider: ZoomMeetingProvider,
    private outlookProvider: OutlookCalendarProvider
  ) {}

  /**
   * Crea un meeting usando Zoom + Outlook Calendar
   */
  async createMeeting(dto: CreateMeetingDto, timezone: string): Promise<MeetingCreationResult> {
    const { eventId, guestEmail, guestName, additionalInfo } = dto;
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    console.log('🎯 [ZOOM_OUTLOOK_STRATEGY] Creating meeting:', {
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
      
      // PASO 3: Obtener integraciones validadas
      const { zoomIntegration, outlookIntegration } = await this.getValidatedIntegrations(event.user.id);
      
      // PASO 4: Crear meeting de Zoom
      console.log('📅 [ZOOM_OUTLOOK_STRATEGY] Step 4: Creating Zoom meeting');
      const meetingInfo = await this.zoomProvider.createMeeting({
        topic: `${guestName} - ${event.title}`,
        startTime,
        endTime,
        timezone,
        agenda: additionalInfo,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          waiting_room: true
        },
        userId: event.user.id
      }, {
        accessToken: zoomIntegration.access_token,
        refreshToken: zoomIntegration.refresh_token,
        expiryDate: zoomIntegration.expiry_date
      });

      // PASO 5: Crear evento en Outlook Calendar
      console.log('📅 [ZOOM_OUTLOOK_STRATEGY] Step 5: Creating Outlook Calendar event');
      const calendarId = this.determineCalendarId(event, outlookIntegration);
      
      const calendarEventId = await this.outlookProvider.createEvent(calendarId, {
        id: '', // Se genera automáticamente
        title: `${guestName} - ${event.title}`,
        description: additionalInfo,
        startTime,
        endTime,
        timezone,
        attendees: [guestEmail, event.user.email],
        meetingUrl: meetingInfo.joinUrl,
        providerSpecific: {
          isOnlineMeeting: true,
          reminderMinutes: [15]
        }
      }, {
        accessToken: outlookIntegration.access_token,
        refreshToken: outlookIntegration.refresh_token,
        expiryDate: outlookIntegration.expiry_date
      });

      // PASO 6: Guardar en base de datos
      console.log('📅 [ZOOM_OUTLOOK_STRATEGY] Step 6: Saving to database');
      const meeting = await this.saveMeetingToDatabase({
        event,
        guestName,
        guestEmail,
        additionalInfo,
        startTime,
        endTime,
        meetLink: meetingInfo.joinUrl,
        calendarEventId,
        calendarAppType: IntegrationAppTypeEnum.OUTLOOK_WITH_ZOOM,
        zoom_meeting_id: Number(meetingInfo.id),
        zoom_join_url: meetingInfo.joinUrl,
        zoom_start_url: meetingInfo.startUrl,
        calendar_id: calendarId
      });

      const result: MeetingCreationResult = {
        meetLink: meetingInfo.joinUrl,
        meeting,
        calendarEventId,
        meetingProviderId: meetingInfo.id,
        additionalData: {
          zoomStartUrl: meetingInfo.startUrl,
          calendarProvider: 'outlook_calendar',
          meetingProvider: 'zoom',
          outlookCalendarId: calendarId,
          zoomMeetingUuid: meetingInfo.additionalData?.uuid
        }
      };

      console.log('✅ [ZOOM_OUTLOOK_STRATEGY] Meeting created successfully:', {
        meetingId: meeting.id,
        zoomMeetingId: meetingInfo.id,
        outlookEventId: calendarEventId,
        calendarId
      });

      return result;

    } catch (error) {
      console.error('❌ [ZOOM_OUTLOOK_STRATEGY] Failed to create meeting:', {
        error: error instanceof Error ? error.message : String(error),
        eventId,
        guestName
      });
      throw error;
    }
  }

  /**
   * Cancela un meeting de Zoom + Outlook Calendar
   */
  async cancelMeeting(meetingId: string): Promise<MeetingCancellationResult> {
    console.log('🗑️ [ZOOM_OUTLOOK_STRATEGY] Cancelling meeting:', { meetingId });

    try {
      // PASO 1: Buscar meeting
      const meeting = await this.getMeetingById(meetingId);
      
      // PASO 2: Obtener integraciones validadas
      const { zoomIntegration, outlookIntegration } = await this.getValidatedIntegrations(meeting.event.user.id);
      
      let zoomDeleted = false;
      let outlookDeleted = false;
      const errors: string[] = [];

      // PASO 3: Cancelar Zoom meeting
      try {
        if (meeting.zoom_meeting_id) {
          console.log('📅 [ZOOM_OUTLOOK_STRATEGY] Cancelling Zoom meeting');
          await this.zoomProvider.deleteMeeting(
            meeting.zoom_meeting_id,
            {
              accessToken: zoomIntegration.access_token,
              refreshToken: zoomIntegration.refresh_token,
              expiryDate: zoomIntegration.expiry_date
            },
            meeting.event.user.id
          );
          zoomDeleted = true;
          console.log('✅ [ZOOM_OUTLOOK_STRATEGY] Zoom meeting cancelled');
        } else {
          console.warn('⚠️ [ZOOM_OUTLOOK_STRATEGY] No Zoom meeting ID found');
          zoomDeleted = true; // Considerar como exitoso
        }
      } catch (error) {
        const errorMsg = `Zoom deletion failed: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.warn('⚠️ [ZOOM_OUTLOOK_STRATEGY]', errorMsg);
        zoomDeleted = true; // Continuar de todas formas
      }

      // PASO 4: Cancelar evento de Outlook
      try {
        console.log('📅 [ZOOM_OUTLOOK_STRATEGY] Cancelling Outlook event');
        const calendarId = meeting.calendar_id || 'primary';
        
        await this.outlookProvider.deleteEvent(
          calendarId,
          meeting.calendarEventId,
          {
            accessToken: outlookIntegration.access_token,
            refreshToken: outlookIntegration.refresh_token,
            expiryDate: outlookIntegration.expiry_date
          }
        );
        outlookDeleted = true;
        console.log('✅ [ZOOM_OUTLOOK_STRATEGY] Outlook event cancelled');
      } catch (error) {
        const errorMsg = `Outlook deletion failed: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.warn('⚠️ [ZOOM_OUTLOOK_STRATEGY]', errorMsg);
        outlookDeleted = true; // Continuar de todas formas
      }

      // PASO 5: Actualizar estado en BD
      console.log('📅 [ZOOM_OUTLOOK_STRATEGY] Updating database status');
      meeting.status = MeetingStatus.CANCELLED;
      await AppDataSource.getRepository(Meeting).save(meeting);

      const result: MeetingCancellationResult = {
        success: true,
        calendarDeleted: outlookDeleted,
        meetingDeleted: zoomDeleted,
        errors: errors.length > 0 ? errors : undefined,
        details: {
          calendarProvider: 'outlook_calendar',
          meetingProvider: 'zoom',
          retryable: errors.length > 0
        }
      };

      console.log('✅ [ZOOM_OUTLOOK_STRATEGY] Meeting cancelled successfully:', {
        meetingId,
        zoomDeleted,
        outlookDeleted,
        errorsCount: errors.length
      });

      return result;

    } catch (error) {
      console.error('❌ [ZOOM_OUTLOOK_STRATEGY] Failed to cancel meeting:', {
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
    console.log('🔍 [ZOOM_OUTLOOK_STRATEGY] Validating integrations for user:', userId);

    try {
      const { zoomIntegration, outlookIntegration } = await this.getValidatedIntegrations(userId);

      // Validar tokens específicos
      console.log('📅 [ZOOM_OUTLOOK_STRATEGY] Validating Zoom token');
      await this.zoomProvider.validateAndRefreshToken({
        accessToken: zoomIntegration.access_token,
        refreshToken: zoomIntegration.refresh_token,
        expiryDate: zoomIntegration.expiry_date
      });
      
      console.log('📅 [ZOOM_OUTLOOK_STRATEGY] Validating Outlook token');
      await this.outlookProvider.validateAndRefreshToken({
        accessToken: outlookIntegration.access_token,
        refreshToken: outlookIntegration.refresh_token,
        expiryDate: outlookIntegration.expiry_date
      });

      console.log('✅ [ZOOM_OUTLOOK_STRATEGY] All integrations validated successfully');
      return true;

    } catch (error) {
      console.error('❌ [ZOOM_OUTLOOK_STRATEGY] Integration validation failed:', error);
      throw new BadRequestException(
        `Integration validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Retorna el nombre de esta estrategia
   */
  getStrategyName(): string {
    return 'ZoomOutlookCalendarStrategy';
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

  private async getIntegrations(userId: string) {
    const integrationRepository = AppDataSource.getRepository(Integration);
    
    const [zoomIntegration, outlookIntegration] = await Promise.all([
      integrationRepository.findOne({
        where: { user: { id: userId }, app_type: IntegrationAppTypeEnum.ZOOM_MEETING }
      }),
      integrationRepository.findOne({
        where: { user: { id: userId }, app_type: IntegrationAppTypeEnum.OUTLOOK_CALENDAR }
      })
    ]);

    return { zoomIntegration, outlookIntegration };
  }

  /**
   * Obtiene integraciones validadas (garantiza que no son null)
   */
  private async getValidatedIntegrations(userId: string): Promise<{
    zoomIntegration: Integration;
    outlookIntegration: Integration;
  }> {
    const { zoomIntegration, outlookIntegration } = await this.getIntegrations(userId);
    
    if (!zoomIntegration) {
      throw new BadRequestException("Zoom integration not found. Please connect your Zoom account.");
    }

    if (!outlookIntegration) {
      throw new BadRequestException("Outlook Calendar integration not found. Please connect your Microsoft account.");
    }

    return { zoomIntegration, outlookIntegration };
  }

  private determineCalendarId(event: Event, outlookIntegration: Integration): string {
    // Prioridad: calendar_id del evento > calendar_id de la integración > 'primary'
    return event.calendar_id || 
           outlookIntegration.outlook_calendar_id || 
           'primary';
  }

  private buildEventDescription(additionalInfo?: string, zoomJoinUrl?: string): string {
    let description = additionalInfo || '';

    if (zoomJoinUrl) {
      description += `\n\n🎥 Join Zoom Meeting: ${zoomJoinUrl}`;
    }

    return description;
  }

  private async saveMeetingToDatabase(data: any): Promise<Meeting> {
    const meetingRepository = AppDataSource.getRepository(Meeting);
    
    const meeting = meetingRepository.create({
      event: data.event,
      user: data.event.user,
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      additionalInfo: data.additionalInfo,
      startTime: data.startTime,
      endTime: data.endTime,
      meetLink: data.meetLink,
      calendarEventId: data.calendarEventId,
      calendarAppType: data.calendarAppType,
      zoom_meeting_id: data.zoom_meeting_id,
      zoom_join_url: data.zoom_join_url,
      zoom_start_url: data.zoom_start_url,
      calendar_id: data.calendar_id,
      status: MeetingStatus.SCHEDULED
    });

    return await meetingRepository.save(meeting);
  }
}