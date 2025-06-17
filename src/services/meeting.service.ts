/**
 * SERVICIO DE GESTIÓN DE REUNIONES
 * 
 * Este archivo contiene la lógica de negocio para:
 * - Obtener reuniones de usuarios con filtros
 * - Crear reservas de reuniones para invitados con integración de Google Calendar/Meet
 * - Cancelar reuniones y eliminar eventos de calendario
 * 
 * Integra con Google Calendar API para crear/eliminar eventos automáticamente
 */

import { LessThan, MoreThan } from "typeorm";
import { AppDataSource } from "../config/database.config";
import { Meeting, MeetingStatus } from "../database/entities/meeting.entity";
import {
  MeetingFilterEnum,
  MeetingFilterEnumType,
} from "../enums/meeting.enum";
import { CreateMeetingDto } from "../database/dto/meeting.dto";
import {
  Event,
  EventLocationEnumType,
} from "../database/entities/event.entity";
import {
  Integration,
  IntegrationAppTypeEnum,
} from "../database/entities/integration.entity";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import { validateGoogleToken, validateZoomToken } from "./integration.service";
import { googleOAuth2Client } from "../config/oauth.config";
import { google } from "googleapis";
// import { toZonedTime, formatInTimeZone, format } from "date-fns-tz";
import { deleteZoomMeetingWithValidation, buildZoomReauthUrl } from '../config/zoom-token-helpers';
import { zoomOAuth2Client } from '../config/oauth.config';
import {
  createOutlookEvent,
  deleteOutlookEvent,
  validateMicrosoftToken
} from './outlook.service';


/**
 * OBTENER REUNIONES DE USUARIO CON FILTROS
 * 
 * Funcionalidad:
 * - Filtra reuniones por estado (próximas, pasadas, canceladas)
 * - Ordena por fecha de inicio ascendente
 * - Incluye información del evento relacionado
 * 
 * @param userId - ID del usuario propietario de las reuniones
 * @param filter - Tipo de filtro: UPCOMING, PAST, CANCELLED
 * @returns Array de reuniones que coinciden con el filtro
 */
export const getUserMeetingsService = async (
  userId: string,
  filter: MeetingFilterEnumType
) => {
  const meetingRepository = AppDataSource.getRepository(Meeting);

  // Configuración base: buscar reuniones del usuario específico
  const where: any = { user: { id: userId } };

  // APLICAR FILTROS SEGÚN EL TIPO SOLICITADO
  if (filter === MeetingFilterEnum.UPCOMING) {
    // Reuniones programadas que aún no han ocurrido
    where.status = MeetingStatus.SCHEDULED;
    where.startTime = MoreThan(new Date()); // Solo futuras
  } else if (filter === MeetingFilterEnum.PAST) {
    // Reuniones programadas que ya pasaron
    where.status = MeetingStatus.SCHEDULED;
    where.startTime = LessThan(new Date()); // Solo pasadas
  } else if (filter === MeetingFilterEnum.CANCELLED) {
    // Reuniones canceladas (cualquier fecha)
    where.status = MeetingStatus.CANCELLED;
  } else {
    // Filtro por defecto: mostrar solo próximas reuniones
    where.status = MeetingStatus.SCHEDULED;
    where.startTime = MoreThan(new Date());
  }

  // Ejecutar consulta con relaciones y ordenamiento
  const meetings = await meetingRepository.find({
    where,
    relations: ["event"], // Incluir datos del evento
    order: { startTime: "ASC" }, // Más próximas primero
  });

  // console.log("Meetings found:", meetings);
  // return meetings || []; // Retornar array vacío si no hay resultados

  // console.log("Meetings found (before date processing):", meetings);

  // PROCESAR FECHAS: Remover 'Z' para que se interpreten como horario local
  const processedMeetings = meetings.map(meeting => {
    const processedMeeting = { ...meeting };

    // Procesar startTime
    if (processedMeeting.startTime) {
      const startTimeStr = processedMeeting.startTime.toISOString();
      processedMeeting.startTime = startTimeStr.replace('Z', '') as any;
    }

    // Procesar endTime
    if (processedMeeting.endTime) {
      const endTimeStr = processedMeeting.endTime.toISOString();
      processedMeeting.endTime = endTimeStr.replace('Z', '') as any;
    }
    return processedMeeting;
  });

  // console.log("Meetings found (after date processing):", processedMeetings);
  return processedMeetings || []; // Retornar array vacío si no hay resultados
};

/**
 * CREAR RESERVA DE REUNIÓN PARA INVITADO
 *
 * Funcionalidad:
 * - Crea una reunión para un invitado con integración de Google Calendar/Meet o Zoom
 * - Valida que el evento exista y sea reservable
 * - Crea el evento en el calendario del organizador
 * - Guarda la reunión en la base de datos
 *
 * @param createMeetingDto - DTO con los datos necesarios para crear la reunión
 * @param timezone - Zona horaria del evento
 * @returns Objeto con detalles de la reunión creada
 */
export const createMeetBookingForGuestService = async (
  createMeetingDto: CreateMeetingDto,
  timezone: string
) => {
  // Extraer y convertir datos del DTO
  const { eventId, guestEmail, guestName, additionalInfo } = createMeetingDto;
  const startTime = new Date(createMeetingDto.startTime);
  const endTime = new Date(createMeetingDto.endTime);

  // Repositorios necesarios
  const eventRepository = AppDataSource.getRepository(Event);
  const integrationRepository = AppDataSource.getRepository(Integration);
  const meetingRepository = AppDataSource.getRepository(Meeting);

  console.log('------------------------------------------------------------');
  console.log('createMeetBookingForGuestService called with:', createMeetingDto);
  console.log('------------------------------------------------------------');

  // PASO 1: VALIDAR QUE EL EVENTO EXISTE Y ES RESERVABLE
  const event = await eventRepository.findOne({
    where: { id: eventId, isPrivate: false },
    relations: ["user"], // Incluir datos del organizador
  });

  if (!event) {
    console.log("Event not found:", eventId);
    throw new NotFoundException("Event not found");
  }
  console.log('paso 1: Event found:', event);
  // PASO 2: VALIDAR TIPO DE UBICACIÓN/INTEGRACIÓN
  if (!Object.values(EventLocationEnumType).includes(event.locationType)) {
    console.log("Invalid location type:", event.locationType);
    throw new BadRequestException("Invalid location type");
  }

  // VALIDACIÓN ESPECIAL: Para Zoom, el evento puede no tener calendar_id por el constraint de BD
  // En este caso, usaremos el calendar_id de la integración de Google Calendar
  let effectiveCalendarId = event.calendar_id;

  if (!effectiveCalendarId && event.locationType === EventLocationEnumType.ZOOM_MEETING) {
    console.log("Zoom event without calendar_id, will use integration calendar_id");
    // Para Zoom, obtendremos el calendar_id de la integración más adelante
  } else if (!effectiveCalendarId) {
    throw new BadRequestException("Event does not have a calendar configured");
  }

  console.log('paso 2: Location type is valid:', event.locationType);
  // PASO 3: BUSCAR INTEGRACIONES NECESARIAS
  let meetIntegration: Integration | null = null;
  let calendarIntegration: Integration | null = null;

  switch (event.locationType) {
    case EventLocationEnumType.GOOGLE_MEET_AND_CALENDAR:
      meetIntegration = await integrationRepository.findOne({
        where: {
          user: { id: event.user.id },
          app_type: IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR,
        },
      });
      calendarIntegration = meetIntegration; // Misma integración
      break;

    case EventLocationEnumType.ZOOM_MEETING:
      // Para Zoom: necesitamos DOS integraciones separadas
      // console.log('paso 3:meet Integration y calendarIntegration se buscarán por separado');
      // 1. Integración de Zoom (para crear la reunión)
      meetIntegration = await integrationRepository.findOne({
        where: {
          user: { id: event.user.id },
          app_type: IntegrationAppTypeEnum.ZOOM_MEETING,
        },
      });
      // console.log('paso 3:meet Integration:', meetIntegration);
      // 2. Integración de Google Calendar (para crear el evento de calendario)
      calendarIntegration = await integrationRepository.findOne({
        where: {
          user: { id: event.user.id },
          app_type: IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR,
        },
      });
      // console.log('paso 3:calendar Integration:', calendarIntegration);
      break;

    case EventLocationEnumType.OUTLOOK_WITH_ZOOM: // ← NUEVO CASO
      // Zoom + Outlook Calendar
      meetIntegration = await integrationRepository.findOne({
        where: {
          user: { id: event.user.id },
          app_type: IntegrationAppTypeEnum.ZOOM_MEETING,
        },
      });

      calendarIntegration = await integrationRepository.findOne({
        where: {
          user: { id: event.user.id },
          app_type: IntegrationAppTypeEnum.OUTLOOK_CALENDAR,
        },
      });
      break;
  }

  // VALIDAR QUE TENEMOS LAS INTEGRACIONES NECESARIAS
  if (!meetIntegration) {
    console.log("No meeting integration found for user:", event.user.id);
    throw new BadRequestException("No meeting integration found");
  }

  if (!calendarIntegration) {
    console.log("No calendar integration found for user:", event.user.id);
    throw new BadRequestException("No calendar integration found. Please connect Google Calendar.");
  }

  // Variables para almacenar datos del calendario/meet
  let meetLink: string = "";
  let calendarEventId: string = "";
  let calendarAppType: string = "";
  let zoomMeetingId: number | undefined = undefined;
  let zoomJoinUrl: string | undefined = undefined;
  let zoomStartUrl: string | undefined = undefined;
  let outlookCalendarId: string | undefined = undefined; // ← NUEVO

  // PASO 4: OBTENER CLIENTE DE CALENDARIO (siempre Google Calendar)
  const { calendar, calendarType } = await getGoogleCalendarClient(
    calendarIntegration.access_token,
    calendarIntegration.refresh_token,
    calendarIntegration.expiry_date
  );

  // console.log('paso 4: Google Calendar client obtained:', calendar);
  // RESOLVER CALENDAR_ID EFECTIVO
  // Para Zoom sin calendar_id, usar el de la integración de Google Calendar
  if (!effectiveCalendarId && event.locationType === EventLocationEnumType.ZOOM_MEETING) {
    if (!calendarIntegration.calendar_id) {
      throw new BadRequestException("No calendar configured in Google Calendar integration. Please configure a default calendar.");
    }
    effectiveCalendarId = calendarIntegration.calendar_id;
    console.log("Using calendar_id from Google Calendar integration for Zoom event:", effectiveCalendarId);
  }

  // Datos comunes para la creación del evento de calendario
  const calendarEventData = {
    title: event.title,
    guestName,
    guestEmail,
    organizerEmail: event.user.email,
    additionalInfo,
    startTime,
    endTime,
    timezone,
    eventId: event.id,
  };

  // PASO 5: CREAR EVENTO SEGÚN EL TIPO DE UBICACIÓN
  if (event.locationType === EventLocationEnumType.GOOGLE_MEET_AND_CALENDAR) {
    // Crear evento en Google Calendar con Google Meet automático
    const calendarResult = await createCalendarEvent(
      calendar,
      effectiveCalendarId, // ✅ Usar effectiveCalendarId
      {
        ...calendarEventData,
        includeConferenceData: true, // Incluir Google Meet automático
      }
    );

    console.log('paso 5: Google Calendar event created:', calendarResult);
    meetLink = calendarResult.hangoutLink!;
    calendarEventId = calendarResult.calendarEventId;
    calendarAppType = IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR; // Tipo de calendario para Google Meet

  } else if (event.locationType === EventLocationEnumType.ZOOM_MEETING) {
    // Primero crear meeting de Zoom
    const { meetingData } = await createZoomMeeting(
      meetIntegration.access_token,
      meetIntegration.refresh_token,
      meetIntegration.expiry_date,
      {
        topic: `${guestName} - ${event.title}`,
        start_time: startTime.toISOString(),
        duration: Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60)),
        timezone: timezone,
        agenda: additionalInfo,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          waiting_room: true
        }
      }
    );
    console.log('paso 5: Zoom meeting created:', meetingData);

    // Luego crear evento en calendario (sin conferenceData automático)
    const calendarResult = await createCalendarEvent(
      calendar,
      effectiveCalendarId,
      {
        ...calendarEventData,
        includeConferenceData: false, // No incluir Google Meet para Zoom
        additionalInfo: `${additionalInfo}\n\nUnirse a Zoom: ${meetingData.join_url}`, // Incluir link de Zoom en descripción
      }
    );
    console.log('paso 5: Calendar event created for Zoom meeting:', calendarResult);

    meetLink = meetingData.join_url;
    calendarEventId = calendarResult.calendarEventId; // ID del evento de calendario
    calendarAppType = IntegrationAppTypeEnum.ZOOM_MEETING; // Tipo de calendario para Zoom

    zoomMeetingId = meetingData.id; // ID de Zoom va en campo separado
    zoomJoinUrl = meetingData.join_url;
    zoomStartUrl = meetingData.start_url;
  } else if (event.locationType === EventLocationEnumType.OUTLOOK_WITH_ZOOM) {
    // NUEVO: Zoom + Outlook Calendar
    console.log('paso 5: Creating Outlook + Zoom meeting');

    // 1. Crear meeting de Zoom
    const { meetingData } = await createZoomMeeting(
      meetIntegration.access_token,
      meetIntegration.refresh_token,
      meetIntegration.expiry_date,
      {
        topic: `${guestName} - ${event.title}`,
        start_time: startTime.toISOString(),
        duration: Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60)),
        timezone: timezone,
        agenda: additionalInfo,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          waiting_room: true
        }
      }
    );

    console.log('paso 5: Zoom meeting created for Outlook:', meetingData);

    // 2. Validar token de Microsoft y crear evento en Outlook
    const validMicrosoftToken = await validateMicrosoftToken(
      calendarIntegration.access_token,
      calendarIntegration.refresh_token,
      calendarIntegration.expiry_date
    );

    // Usar outlook_calendar_id del evento o de la integración
    const outlookCalendarId = event.calendar_id ||
      calendarIntegration.outlook_calendar_id ||
      'primary';

    const outlookEvent = await createOutlookEvent(
      validMicrosoftToken,
      outlookCalendarId,
      {
        title: `${guestName} - ${event.title}`,
        description: additionalInfo,
        startTime,
        endTime,
        timezone,
        attendeeEmail: guestEmail,
        organizerEmail: event.user.email,
        zoomJoinUrl: meetingData.join_url // Incluir link de Zoom
      }
    );

    console.log('paso 5: Outlook event created with Zoom link:', outlookEvent);

    // Asignar datos para guardar en BD
    meetLink = meetingData.join_url;
    calendarEventId = outlookEvent.id; // ID del evento de Outlook
    calendarAppType = IntegrationAppTypeEnum.OUTLOOK_WITH_ZOOM;

    zoomMeetingId = meetingData.id;
    zoomJoinUrl = meetingData.join_url;
    zoomStartUrl = meetingData.start_url;
  }

  // PASO 6: GUARDAR REUNIÓN EN BASE DE DATOS
  // PASO 6: GUARDAR REUNIÓN EN BASE DE DATOS
  const meeting = meetingRepository.create({
    event: event,
    user: event.user, // Organizador (heredado del evento)
    guestName,
    guestEmail,
    additionalInfo,
    startTime,
    endTime,
    meetLink: meetLink,
    calendarEventId: calendarEventId,
    calendarAppType: calendarAppType,
    // ✅ AJUSTE PARA CONSTRAINT: calendar_id solo para Google Meet
    ...(event.locationType === EventLocationEnumType.GOOGLE_MEET_AND_CALENDAR && {
      calendar_id: effectiveCalendarId,
    }),
    // ✅ AJUSTE PARA CONSTRAINT: campos Zoom solo para Zoom
    ...(event.locationType === EventLocationEnumType.ZOOM_MEETING && {
      zoom_meeting_id: zoomMeetingId,
      zoom_join_url: zoomJoinUrl,
      zoom_start_url: zoomStartUrl,
      // calendar_id debe ser NULL para Zoom según constraint
    }),
    // Outlook + Zoom: ambos tipos de campos
    ...(event.locationType === EventLocationEnumType.OUTLOOK_WITH_ZOOM && {
      zoom_meeting_id: zoomMeetingId,
      zoom_join_url: zoomJoinUrl,
      zoom_start_url: zoomStartUrl,
      // También guardar el calendar ID de Outlook para cancelación
      calendar_id: outlookCalendarId,
    })
  });

  console.log('paso 6: Meeting entity created:', meeting);
  await meetingRepository.save(meeting);

  // Retornar datos importantes para el frontend
  return {
    meetLink,
    meeting,
  };
};


/**
 * cancelMeetingService
 * @param meetingId  - ID de la reunión a cancelar
 * @returns Objeto indicando éxito de la operación
 */
export const cancelMeetingService = async (meetingId: string) => {
  const meetingRepository = AppDataSource.getRepository(Meeting);
  const integrationRepository = AppDataSource.getRepository(Integration);
  console.log('------------------------------------------------------------');
  console.log('cancelMeetingService called with meetingId:', meetingId);
  console.log('------------------------------------------------------------');

  // PASO 1: BUSCAR REUNIÓN CON DATOS DEL EVENTO Y USUARIO
  const meeting = await meetingRepository.findOne({
    where: { id: meetingId },
    relations: ["event", "event.user"],
  });

  if (!meeting) throw new NotFoundException("Meeting not found");

  // VALIDACIÓN: Usar calendar_id de la reunión (que puede ser diferente al del evento para Zoom)
  let effectiveCalendarId = meeting.calendar_id || meeting.event.calendar_id;
  console.log('paso 1: Meeting found:', {
    id: meeting.id,
    guestName: meeting.guestName,
    meetingCalendarId: meeting.calendar_id,
    eventCalendarId: meeting.event.calendar_id,
    locationType: meeting.event.locationType
  });

  try {
    // PASO 2: BUSCAR INTEGRACIONES NECESARIAS
    let zoomIntegration: Integration | null = null;
    let calendarIntegration: Integration | null = null;
    // let effectiveCalendarId: string | null = null;

    if (meeting.event.locationType === EventLocationEnumType.GOOGLE_MEET_AND_CALENDAR) {
      // Para Google Meet: una sola integración
      calendarIntegration = await integrationRepository.findOne({
        where: {
          user: { id: meeting.event.user.id },
          app_type: IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR,
        },
      });

    } else if (meeting.event.locationType === EventLocationEnumType.ZOOM_MEETING) {
      // Para Zoom: necesitamos ambas integraciones

      // 1. Integración de Zoom (para eliminar reunión)
      zoomIntegration = await integrationRepository.findOne({
        where: {
          user: { id: meeting.event.user.id },
          app_type: IntegrationAppTypeEnum.ZOOM_MEETING,
        },
      });
      console.log('paso 2: Zoom integration found:', zoomIntegration);

      // 2. Integración de calendario (para eliminar evento)
      calendarIntegration = await integrationRepository.findOne({
        where: {
          user: { id: meeting.event.user.id },
          app_type: IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR,
        },
      });

      console.log('paso 2: Calendar integration found:', calendarIntegration);
      // ✅ CLAVE: Para Zoom, obtener calendar_id de la integración
      if (calendarIntegration && calendarIntegration.calendar_id) {
        // effectiveCalendarId = calendarIntegration.calendar_id;
        // ✅ PARA ZOOM: Usar calendar_id del evento (que ahora sí se guarda)
        effectiveCalendarId = meeting.event.calendar_id || calendarIntegration.calendar_id || 'primary';
        console.log('paso 2: Updated effective calendar ID for Zoom:', effectiveCalendarId);
      }
    } else if (meeting.event.locationType === EventLocationEnumType.OUTLOOK_WITH_ZOOM) {
      // NUEVO: Outlook + Zoom
      // 1. Integración de Zoom
      zoomIntegration = await integrationRepository.findOne({
        where: {
          user: { id: meeting.event.user.id },
          app_type: IntegrationAppTypeEnum.ZOOM_MEETING,
        },
      });

      // 2. Integración de Outlook
      calendarIntegration = await integrationRepository.findOne({
        where: {
          user: { id: meeting.event.user.id },
          app_type: IntegrationAppTypeEnum.OUTLOOK_CALENDAR,
        },
      });

      console.log('paso 2: Outlook + Zoom integrations found:', {
        zoomIntegration: !!zoomIntegration,
        outlookIntegration: !!calendarIntegration
      });
    }

    if (!calendarIntegration) {
      console.warn(`No calendar integration found for user ${meeting.event.user.id}`);
      throw new BadRequestException("No calendar integration found for this user");
    }

    console.log('paso 2: Integrations found:', {
      zoomIntegration: !!zoomIntegration,
      calendarIntegration: !!calendarIntegration,
      calendarIntegrationCalendarId: calendarIntegration?.calendar_id
    });

    if (!effectiveCalendarId) {
      console.error('No effective calendar ID found. Meeting calendar_id:', meeting.calendar_id,
        'Event calendar_id:', meeting.event.calendar_id,
        'Integration calendar_id:', calendarIntegration?.calendar_id);
      throw new BadRequestException("No calendar configured for this meeting");
    }

    // PASO 3: OBTENER CLIENTE DE CALENDAR (siempre Google Calendar)
    const { calendar, calendarType } = await getGoogleCalendarClient(
      calendarIntegration.access_token,
      calendarIntegration.refresh_token,
      calendarIntegration.expiry_date
    );

    console.log('paso 2: Final effective calendar ID:', effectiveCalendarId);
    // PASO 4: ELIMINAR SEGÚN EL TIPO DE EVENTO
    if (meeting.event.locationType === EventLocationEnumType.GOOGLE_MEET_AND_CALENDAR) {
      // Para Google Meet: solo eliminar el evento del calendario
      await deleteCalendarEvent(
        calendar,
        effectiveCalendarId, // ✅ Usar effectiveCalendarId
        meeting.calendarEventId,
        calendarType
      );

    } else if (meeting.event.locationType === EventLocationEnumType.ZOOM_MEETING) {
      // Para Zoom: eliminar TANTO la reunión de Zoom COMO el evento de calendario

      if (!zoomIntegration) {
        throw new BadRequestException("No Zoom integration found for this user");
      }
      let zoomDeletionSuccess = false;
      if (meeting.zoom_meeting_id) {
        try {
          const validZoomToken = await validateZoomToken(
            zoomIntegration.access_token,
            zoomIntegration.refresh_token,
            zoomIntegration.expiry_date
          );

          console.log('paso 5: Attempting to delete Zoom meeting:', {
            zoomMeetingId: meeting.zoom_meeting_id
          });

          await deleteZoomMeeting(
            validZoomToken,
            meeting.zoom_meeting_id.toString(),
            meeting.event.user.id
          );

          zoomDeletionSuccess = true;
          console.log('✅ Zoom meeting deleted successfully');

        } catch (zoomError) {
          // ✅ MANEJO GRACEFUL: Si la reunión de Zoom no existe, continuar
          console.warn('⚠️ Failed to delete Zoom meeting (meeting may not exist):', {
            zoomMeetingId: meeting.zoom_meeting_id,
            error: zoomError instanceof Error ? zoomError.message : String(zoomError)
          });

          // Verificar si es un error de "no existe" vs otros errores
          const errorMessage = zoomError instanceof Error ? zoomError.message : String(zoomError);
          const isMeetingNotFound = errorMessage.toLowerCase().includes('does not exist') ||
            errorMessage.toLowerCase().includes('not found') ||
            errorMessage.toLowerCase().includes('meeting not found');

          if (isMeetingNotFound) {
            console.log('📝 Zoom meeting appears to have been deleted already - continuing with calendar cleanup');
            zoomDeletionSuccess = true; // Considerar como éxito si ya no existe
          } else {
            // Para otros errores (permisos, token, etc.), aún consideramos continuar 
            // pero loggeamos como warning
            console.warn('📝 Zoom meeting deletion failed but continuing with calendar cleanup');
            zoomDeletionSuccess = true; // Continuar de todas formas
          }
        }
      } else {
        console.warn('⚠️ No Zoom meeting ID found - skipping Zoom deletion');
        zoomDeletionSuccess = true; // Continuar sin ID de Zoom
      }

      // // 1. Eliminar reunión de Zoom
      // const validZoomToken = await validateZoomToken(
      //   zoomIntegration.access_token,
      //   zoomIntegration.refresh_token,
      //   zoomIntegration.expiry_date
      // );

      // if (!meeting.zoom_meeting_id) {
      //   throw new BadRequestException("Zoom meeting ID not found");
      // }

      // console.log('paso 4: Deleting Zoom meeting with ID:', meeting.zoom_meeting_id);
      // await deleteZoomMeeting(
      //   validZoomToken,
      //   meeting.zoom_meeting_id.toString(),
      //   meeting.event.user.id
      // );

      // 2. Eliminar evento del calendario
      // ✅ SIEMPRE intentar eliminar evento del calendario (independiente del resultado de Zoom)
      try {
        console.log('paso 5: Deleting Zoom calendar event:', {
          calendarId: effectiveCalendarId,
          eventId: meeting.calendarEventId
        });

        await deleteCalendarEvent(
          calendar,
          effectiveCalendarId,
          meeting.calendarEventId,
          calendarType
        );

        console.log('✅ Calendar event deleted successfully');

      } catch (calendarError) {
        console.error('❌ Failed to delete calendar event:', calendarError);

        // Si no pudimos eliminar ni Zoom ni calendario, fallar
        if (!zoomDeletionSuccess) {
          throw new BadRequestException('Failed to delete both Zoom meeting and calendar event');
        }

        // Si Zoom se eliminó pero calendario falló, continuar pero advertir
        console.warn('⚠️ Zoom meeting deleted but calendar event deletion failed - meeting will be marked as cancelled');
      }

      // ✅ LOGGING final del resultado
      if (zoomDeletionSuccess) {
        console.log('✅ Zoom meeting cancellation completed (some operations may have been skipped)');
      }

    } else if (meeting.event.locationType === EventLocationEnumType.OUTLOOK_WITH_ZOOM) {
      // Outlook + Zoom: eliminar AMBOS

      if (!zoomIntegration || !calendarIntegration) {
        throw new BadRequestException("Missing integrations for Outlook + Zoom");
      }

      let zoomDeletionSuccess = false;
      let outlookDeletionSuccess = false;

      // 1. Eliminar reunión de Zoom
      if (meeting.zoom_meeting_id) {
        try {
          const validZoomToken = await validateZoomToken(
            zoomIntegration.access_token,
            zoomIntegration.refresh_token,
            zoomIntegration.expiry_date
          );

          await deleteZoomMeeting(
            validZoomToken,
            meeting.zoom_meeting_id.toString(),
            meeting.event.user.id
          );

          zoomDeletionSuccess = true;
          console.log('✅ Zoom meeting deleted successfully');

        } catch (zoomError) {
          console.warn('⚠️ Failed to delete Zoom meeting:', zoomError);
          zoomDeletionSuccess = true; // Continuar de todas formas
        }
      }

      // 2. Eliminar evento de Outlook
      try {
        const validMicrosoftToken = await validateMicrosoftToken(
          calendarIntegration.access_token,
          calendarIntegration.refresh_token,
          calendarIntegration.expiry_date
        );

        await deleteOutlookEvent(validMicrosoftToken, meeting.calendarEventId);

        outlookDeletionSuccess = true;
        console.log('✅ Outlook event deleted successfully');

      } catch (outlookError) {
        console.warn('⚠️ Failed to delete Outlook event:', outlookError);
        outlookDeletionSuccess = true; // Continuar de todas formas
      }

      if (zoomDeletionSuccess && outlookDeletionSuccess) {
        console.log('✅ Outlook + Zoom meeting cancelled successfully');
      }
    }

  } catch (error) {
    console.error("Calendar/Meeting deletion error:", error);
    throw error;
  }

  // PASO 5: MARCAR REUNIÓN COMO CANCELADA EN BASE DE DATOS
  meeting.status = MeetingStatus.CANCELLED;
  await meetingRepository.save(meeting);

  console.log('✅ Meeting cancelled successfully:', {
    meetingId: meeting.id,
    guestName: meeting.guestName,
    locationType: meeting.event.locationType
  });

  return { success: true };
};



/**
 * Crea una reunión en Zoom
 * @param access_token - Token de acceso de Zoom
 * @param refresh_token - Token de actualización de Zoom
 * @param expiry_date - Fecha de expiración del token
 * @param meetingData - Datos de la reunión a crear
 * @returns Objeto con información de la reunión creada
 */
async function createZoomMeeting(
  access_token: string,
  refresh_token: string,
  expiry_date: number | null,
  meetingData: any
) {
  // Validar token
  const validToken = await validateZoomToken(access_token, refresh_token, expiry_date);

  // Crear meeting en Zoom
  const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${validToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      topic: meetingData.topic,
      type: 2, // Scheduled meeting
      start_time: meetingData.start_time,
      duration: meetingData.duration,
      timezone: meetingData.timezone,
      agenda: meetingData.agenda,
      settings: meetingData.settings
    })
  });

  const meeting = await response.json();

  if (!response.ok) {
    throw new BadRequestException(`Failed to create Zoom meeting: ${meeting.message}`);
  }

  if (!meeting.join_url || !meeting.start_url) {
    console.warn("Zoom meeting missing URLs:", meeting);
  }
  console.log("Zoom meeting created:", meeting);

  return {
    meetingData: meeting,
    meetingType: IntegrationAppTypeEnum.ZOOM_MEETING
  };
}

/**
 * Crea un evento de calendario en Google Calendar
 * @param calendarClient - Cliente de Google Calendar autenticado
 * @param calendarId - ID del calendario donde se creará el evento
 * @param eventData - Datos del evento a crear
 * @returns Objeto con ID del evento y enlace de Google Meet (si aplica)
 */
const createCalendarEvent = async (
  calendarClient: any,
  calendarId: string,
  eventData: {
    title: string;
    guestName: string;
    guestEmail: string;
    organizerEmail: string;
    additionalInfo?: string;
    startTime: Date;
    endTime: Date;
    timezone: string;
    eventId: string;
    includeConferenceData?: boolean;
  }
) => {
  const formatDateForCalendar = (date: Date) => {
    return date.toISOString().replace('Z', '');
  };

  const formattedStart = formatDateForCalendar(eventData.startTime);
  const formattedEnd = formatDateForCalendar(eventData.endTime);

  console.log('------------------------------------------------------------');
  console.log('createCalendarEvent called with calendarId:', calendarId);
  console.log('eventData:', eventData);
  console.log('------------------------------------------------------------');

  // console.log('---------------------------------------------------------------');
  // console.log('startTime:', eventData.startTime);
  // console.log('endTime:', eventData.endTime);
  // console.log('timezone startTime:', eventData.timezone, formattedStart);
  // console.log('timezone endTime:', eventData.timezone, formattedEnd);
  // console.log('---------------------------------------------------------------');

  if (!calendarClient) {
    throw new BadRequestException("Failed to initialize Calendar client");
  }

  const requestBody: any = {
    summary: `${eventData.guestName} - ${eventData.title}`,
    description: eventData.additionalInfo,
    start: {
      dateTime: formattedStart,
      timeZone: eventData.timezone,
    },
    end: {
      dateTime: formattedEnd,
      timeZone: eventData.timezone,
    },
    attendees: [
      { email: eventData.guestEmail },
      { email: eventData.organizerEmail }
    ],
  };

  // Solo incluir conferenceData si se solicita (para Google Meet)
  if (eventData.includeConferenceData) {
    requestBody.conferenceData = {
      createRequest: {
        requestId: `${eventData.eventId}-${Date.now()}`,
      },
    };
  }

  const response = await calendarClient.events.insert({
    calendarId: calendarId,
    conferenceDataVersion: eventData.includeConferenceData ? 1 : 0,
    requestBody,
  });

  // console.log("Calendar event created:", response.data);

  return {
    calendarEventId: response.data.id!,
    hangoutLink: response.data.hangoutLink || null
  };
};

/**
 * Elimina un evento de calendario de Google Calendar
 * @param calendarClient - Cliente de Google Calendar autenticado
 * @param calendarId - ID del calendario del que se eliminará el evento
 * @param eventId - ID del evento a eliminar
 * @param calendarType - Tipo de calendario (para logs)
 */
const deleteCalendarEvent = async (
  calendarClient: any,
  calendarId: string,
  eventId: string,
  calendarType: string
) => {
  console.log('------------------------------------------------------------');
  console.log('cancelMeetingService called with calendarId:', calendarId);
  console.log('------------------------------------------------------------');
  if (!calendarClient) {
    throw new BadRequestException(`Failed to initialize ${calendarType} Calendar client`);
  }

  await calendarClient.events.delete({
    calendarId: calendarId,
    eventId: eventId,
  });

  console.log(`✅ Calendar event deleted successfully from ${calendarType}`);
};

/**
 * Elimina una reunión de Zoom con validación de permisos
 * @param accessToken - Token de acceso de Zoom
 * @param zoomMeetingId - ID de la reunión de Zoom a eliminar
 * @param userId - ID del usuario propietario de la reunión (para reautenticación)
 */
const deleteZoomMeeting = async (
  accessToken: string,
  zoomMeetingId: string,
  userId: string
) => {
  console.log('------------------------------------------------------------');
  console.log('deleteZoomMeeting called with zoomMeetingId:', zoomMeetingId);
  console.log('------------------------------------------------------------');

  const deleteResult = await deleteZoomMeetingWithValidation(
    accessToken,
    zoomMeetingId
  );

  if (!deleteResult.success) {
    if (deleteResult.needsReauth) {
      const reauthUrl = buildZoomReauthUrl(
        zoomOAuth2Client.clientId,
        zoomOAuth2Client.redirectUri,
        userId
      );

      throw new BadRequestException(
        `Missing required permissions for Zoom. User needs to reauthorize: ${reauthUrl}`
      );
    } else {
      throw new BadRequestException(
        `Failed to delete Zoom meeting: ${deleteResult.error}`
      );
    }
  }

  console.log('✅ Zoom meeting deleted successfully');
};


/**
 * Obtiene un cliente de Google Calendar autenticado
 * @param access_token - Token de acceso OAuth2
 * @param refresh_token - Token de actualización OAuth2
 * @param expiry_date - Fecha de expiración del token
 * @returns Objeto con cliente de calendario y tipo de integración
 */
async function getGoogleCalendarClient(
  access_token: string,
  refresh_token: string,
  expiry_date: number | null
) {
  // Validar y obtener token válido de Google
  const validToken = await validateGoogleToken(
    access_token,
    refresh_token,
    expiry_date
  );

  // Configurar cliente OAuth2 de Google
  googleOAuth2Client.setCredentials({ access_token: validToken });

  // Crear cliente de Google Calendar API
  const calendar = google.calendar({
    version: "v3",
    auth: googleOAuth2Client,
  });

  return {
    calendar,
    calendarType: IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR,
    accessToken: validToken
  };
}
