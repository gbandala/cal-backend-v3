import { AvailabilityResponseType } from "../@types/availability.type";
import { AppDataSource } from "../config/database.config";
import { User } from "../database/entities/user.entity";
import { NotFoundException } from "../utils/app-error";
import { UpdateAvailabilityDto } from "../database/dto/availability.dto";
import { Availability } from "../database/entities/availability.entity";
import { DayOfWeekEnum } from "../database/entities/day-availability";
import { Event } from "../database/entities/event.entity";
import { Integration } from "../database/entities/integration.entity";
import { IntegrationAppTypeEnum } from "../enums/integration.enum";
import { addDays,addMinutes, format, parseISO } from "date-fns";
import { EventLocationEnumType } from "../enums/EventLocationEnum";
import { Between } from "typeorm";
import { Meeting } from "../database/entities/meeting.entity";
import { MeetingStatus } from "../enums/meeting.enum";


import {
  convertMeetingsToUserTimezone,
  generateTimeSlotsInUserTimezone,
  checkSlotConflicts,
  convertUTCToUserTimezone,
} from "../utils/timezone-helpers";

import {
  getGoogleCalendarEvents,
  validateGoogleCalendarToken
} from "../services/google.service";

import {
  getOutlookCalendarEvents,
  validateMicrosoftToken
} from "../services/outlook.service";

export const getUserAvailabilityService = async (userId: string, timezone: string = 'UTC') => {
  const userRepository = AppDataSource.getRepository(User);

  const user = await userRepository.findOne({
    where: { id: userId },
    relations: ["availability", "availability.days"],
  });

  if (!user || !user.availability) {
    console.log("User not found or availability not set:", userId);
    throw new NotFoundException("User not found or availability");
  }

  const availabilityData: AvailabilityResponseType = {
    timeGap: user.availability.timeGap,
    days: [],
  };

  user.availability.days.forEach((dayAvailability) => {
    availabilityData.days.push({
      day: dayAvailability.day,
      startTime: dayAvailability.startTime.slice(0, 5),
      endTime: dayAvailability.endTime.slice(0, 5),
      isAvailable: dayAvailability.isAvailable,
    });
  });

  console.log("User availability data:", availabilityData);
  return availabilityData;
};

export const updateAvailabilityService = async (
  userId: string,
  data: UpdateAvailabilityDto,
  timezone: string = 'UTC'
) => {
  const userRepository = AppDataSource.getRepository(User);
  const availabilityRepository = AppDataSource.getRepository(Availability);

  const user = await userRepository.findOne({
    where: { id: userId },
    relations: ["availability", "availability.days"],
  });

  if (!user) {
    console.log("User not found:", userId);
    throw new NotFoundException("User not found");
  }

  const dayAvailabilityData = data.days.map(
    ({ day, isAvailable, startTime, endTime }) => {
      return {
        day: day.toUpperCase() as DayOfWeekEnum,
        startTime: startTime,
        endTime: endTime,
        isAvailable,
      };
    }
  );

  if (user.availability) {
    await availabilityRepository.save({
      id: user.availability.id,
      timeGap: data.timeGap,
      days: dayAvailabilityData.map((day) => ({
        ...day,
        availability: { id: user.availability.id },
      })),
    });
  }

  return { success: true };
};

export const getAvailabilityForPublicEventService = async (
  eventId: string,
  timezone: string = 'UTC',
  date?: string
) => {

  const eventRepository = AppDataSource.getRepository(Event);

  try {
    // 1. Buscar evento con relaciones necesarias
    const event = await eventRepository.findOne({
      where: { id: eventId, isPrivate: false },
      relations: [
        "user",
        "user.availability",
        "user.availability.days",
        "user.meetings",
      ],
    });

    if (!event || !event.user.availability) return [];

    // console.log('✅ [AVAILABILITY] Event and availability found');

    const { availability, meetings } = event.user;
    const daysOfWeek = Object.values(DayOfWeekEnum);
    const availableDays = [];

    // 2. Determinar fecha objetivo
    let targetDate: Date | null = null;
    let targetDayOfWeek: string | null = null;

    if (date) {
      targetDate = parseISO(date);
      targetDayOfWeek = format(targetDate, 'EEEE').toUpperCase();
      daysOfWeek.length = 0;
      daysOfWeek.push(targetDayOfWeek as DayOfWeekEnum);
    }

    // 3. Procesar cada día de la semana
    for (const dayOfWeek of daysOfWeek) {
      const dayDate = targetDate || getNextDateForDay(dayOfWeek);
      const dayAvailability = availability.days.find((d) => d.day === dayOfWeek);

      if (dayAvailability && dayAvailability.isAvailable) {
        const dateStr = format(dayDate, "yyyy-MM-dd");

        const dayMeetingsUTC = meetings.filter(meeting => {
          if (meeting.status !== MeetingStatus.SCHEDULED) return false;

          // Convertir la fecha objetivo a UTC para comparar
          const targetDateUTC = format(parseISO(`${dateStr}T12:00:00Z`), 'yyyy-MM-dd');
          const meetingDateUTC = format(meeting.startTime, 'yyyy-MM-dd');

          return meetingDateUTC === targetDateUTC;
        });

        console.log('🐛 [DEBUG] Meetings conversion check:');
        dayMeetingsUTC.forEach(meeting => {
          const utcTime = format(meeting.startTime, 'HH:mm');
          const userTzMeeting = convertMeetingsToUserTimezone([meeting], timezone)[0];
          const localTime = format(userTzMeeting.startTime, 'HH:mm');

          console.log(`   Meeting "${meeting.guestName}": ${utcTime} UTC → ${localTime} ${timezone}`);
        });

        // 2. DESPUÉS convertir a timezone del usuario
        const meetingsInUserTz = convertMeetingsToUserTimezone(dayMeetingsUTC, timezone);
        console.log('[DB-MEETINGS]:', meetingsInUserTz);

        // 🔥 5. OBTENER EVENTOS DE CALENDARIO SEGÚN EL PROVEEDOR
        const calendarEventsInUserTz = await getCalendarEventsForEvent(
          event,
          dateStr,
          timezone
        );

        // 6. Generar slots en timezone del usuario
        const slotsResult = generateAvailableTimeSlotsWithTimezone(
          dayAvailability.startTime.slice(0, 5),  // "09:00"
          dayAvailability.endTime.slice(0, 5),    // "17:00"
          event.duration,
          meetingsInUserTz,
          calendarEventsInUserTz,
          dateStr,
          availability.timeGap,
          timezone
        );

        // 7. Agregar resultado
        availableDays.push({
          day: dayOfWeek,
          date: dateStr,
          slots: slotsResult.availableSlots,  // ✅ Usar availableSlots del resultado
          isAvailable: true,
          slotsBlocked: slotsResult.blockedSlots, // 🔥 NUEVO: Agregar slots bloqueados
          debug: {
            totalCalendarEvents: calendarEventsInUserTz.length,
            blockingCalendarEvents: calendarEventsInUserTz.filter(e => e.status === 'confirmed').length,
            meetingsCount: meetingsInUserTz.length,
            calendarId: event.calendar_id,
            calendarProvider: await determineCalendarProvider(event)
          }
        });
      }
    }


    return availableDays;

  } catch (error) {
    console.error('❌ [AVAILABILITY] Error:', error);
    return [];
  }
};

function timeStringToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// function generateAvailableTimeSlotsWithTimezone(
//   startTime: string,        // "09:00"
//   endTime: string,          // "17:00"
//   duration: number,         // 60 minutos
//   meetings: Array<{ startTime: Date; endTime: Date; guestName?: string; status: string }>,
//   calendarEvents: Array<{ start: string; end: string; title: string; status: string }>,
//   dateStr: string,          // "2025-06-27"
//   timeGap: number = 30,
//   timezone: string
// ): {
//   availableSlots: string[],
//   blockedSlots: Array<{ slot: string; reason: string; value: string; timeRange: string }>
// } {

//   console.log('🔍 [SLOTS] Generating slots for ' + dateStr + ':', {
//     startTime,
//     endTime,
//     duration: duration + 'min',
//     timeGap: timeGap + 'min',
//     meetingsCount: meetings.length,
//     calendarEventsCount: calendarEvents.length,
//     isToday: format(new Date(), 'yyyy-MM-dd') === dateStr
//   });

//   // 🔥 LOG DETALLADO DE CONFLICTOS PARA DEBUGGING
//   console.log('📋 [SLOTS] Meetings blocking slots:');
//   meetings.forEach(meeting => {
//     const startInUserTz = convertUTCToUserTimezone(meeting.startTime, timezone);
//     const endInUserTz = convertUTCToUserTimezone(meeting.endTime, timezone);
//     console.log(`   🚫 Meeting: "${meeting.guestName}" ${format(startInUserTz, 'HH:mm')}-${format(endInUserTz, 'HH:mm')}`);
//   });

//   console.log('📋 [SLOTS] Calendar events blocking slots:');
//   calendarEvents.forEach(event => {
//     if (event.status === 'confirmed') {
//       console.log(`   🚫 Calendar: "${event.title}" ${event.start}-${event.end}`);
//     }
//   });

//   const availableSlots: string[] = [];
//   const blockedSlots: Array<{ slot: string; reason: string; value: string; timeRange: string }> = [];

//   // Generar todos los slots posibles en timezone del usuario
//   const allSlots = generateTimeSlotsInUserTimezone(
//     startTime,
//     endTime,
//     timeGap,
//     dateStr,
//     timezone
//   );

//   // Filtrar slots considerando duración del evento
//   for (const slotStart of allSlots) {
//     // Calcular cuándo terminaría este slot
//     const slotStartParts = slotStart.split(':');
//     const slotStartMinutes = parseInt(slotStartParts[0]) * 60 + parseInt(slotStartParts[1]);
//     const slotEndMinutes = slotStartMinutes + duration;
//     const slotEndHours = Math.floor(slotEndMinutes / 60);
//     const slotEndMins = slotEndMinutes % 60;
//     const slotEnd = `${slotEndHours.toString().padStart(2, '0')}:${slotEndMins.toString().padStart(2, '0')}`;

//     // Verificar que el slot completo cabe en horario disponible
//     const endTimeParts = endTime.split(':');
//     const endTimeMinutes = parseInt(endTimeParts[0]) * 60 + parseInt(endTimeParts[1]);

//     if (slotEndMinutes > endTimeMinutes) {
//       continue; // Slot no cabe en horario disponible
//     }

//     // Verificar conflictos
//     const conflictCheck = checkSlotConflicts(
//       slotStart,
//       slotEnd,
//       dateStr,
//       timezone,
//       meetings,
//       calendarEvents
//     );

//     if (!conflictCheck.hasConflict) {
//       console.log(`   ✅ [AVAILABLE] Slot ${slotStart}-${slotEnd} is available`);
//       availableSlots.push(slotStart);
//     } else {
//       // ✅ CAPTURAR INFORMACIÓN DEL SLOT BLOQUEADO
//       const conflictTitle = conflictCheck.conflictDetail?.title || conflictCheck.conflictDetail?.guestName || 'Unknown';
//       const conflictTime = conflictCheck.conflictDetail?.eventTime || conflictCheck.conflictDetail?.meetingTime || 'Unknown time';
//       const reason = conflictCheck.conflictDetail?.type === 'meeting' ? 'meeting' : 'calendar';

//       // 🔥 AGREGAR AL ARRAY DE SLOTS BLOQUEADOS
//       blockedSlots.push({
//         slot: slotStart,
//         reason: reason,
//         value: conflictTitle,
//         timeRange: conflictTime
//       });

//       console.log(`   ❌ [CONFLICT] Slot ${slotStart}-${slotEnd} conflicts with ${conflictCheck.conflictDetail?.type}: "${conflictTitle}" (${conflictTime})`);
//     }
//   }

//   console.log(`✅ [SLOTS] Generated ${availableSlots.length} available slots and ${blockedSlots.length} blocked slots for ${dateStr}`);
//   console.log('🚫 [BLOCKED] Blocked slots:', blockedSlots);
//   console.log('------------------------------------------------------------------');

//   return { availableSlots, blockedSlots };
// }

function generateAvailableTimeSlotsWithTimezone(
  startTime: string,        // "09:00"
  endTime: string,          // "17:00"
  duration: number,         // 60 minutos
  meetings: Array<{ startTime: Date; endTime: Date; guestName?: string; status: string }>,
  calendarEvents: Array<{ start: string; end: string; title: string; status: string }>,
  dateStr: string,          // "2025-06-30"
  timeGap: number = 30,
  timezone: string
): {
  availableSlots: string[],
  blockedSlots: Array<{ slot: string; reason: string; value: string; timeRange: string }>
} {

  console.log('🔍 [SLOTS] Generating slots for ' + dateStr + ':', {
    startTime,
    endTime,
    duration: duration + 'min',
    timeGap: timeGap + 'min',
    meetingsCount: meetings.length,
    calendarEventsCount: calendarEvents.length,
    isToday: format(new Date(), 'yyyy-MM-dd') === dateStr
  });

  // 🔥 LOG DETALLADO DE CONFLICTOS PARA DEBUGGING
  console.log('📋 [SLOTS] Meetings blocking slots:');
  meetings.forEach(meeting => {
    const startInUserTz = convertUTCToUserTimezone(meeting.startTime, timezone);
    const endInUserTz = convertUTCToUserTimezone(meeting.endTime, timezone);
    console.log(`   🚫 Meeting: "${meeting.guestName}" ${format(startInUserTz, 'HH:mm')}-${format(endInUserTz, 'HH:mm')}`);
  });

  console.log('📋 [SLOTS] Calendar events blocking slots:');
  calendarEvents.forEach(event => {
    if (event.status === 'confirmed') {
      console.log(`   🚫 Calendar: "${event.title}" ${event.start}-${event.end}`);
    }
  });

  const availableSlots: string[] = [];
  const blockedSlots: Array<{ slot: string; reason: string; value: string; timeRange: string }> = [];

  // ✅ NUEVO: Verificar si es hoy y calcular hora mínima
  const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
  let minimumStartTime: string | null = null;

  if (isToday) {
    // Obtener hora actual en el timezone del usuario
    const now = new Date();
    const nowInUserTz = convertUTCToUserTimezone(now, timezone);
    
    // Agregar margen de 30 minutos (o el timeGap configurado)
    const minimumBookingTime = addMinutes(nowInUserTz, Math.max(30, timeGap));
    minimumStartTime = format(minimumBookingTime, 'HH:mm');
    
    console.log(`⏰ [TODAY_FILTER] Current time in ${timezone}: ${format(nowInUserTz, 'HH:mm')}`);
    console.log(`⏰ [TODAY_FILTER] Minimum booking time: ${minimumStartTime} (${Math.max(30, timeGap)} min margin)`);
  }

  // Generar todos los slots posibles en timezone del usuario
  const allSlots = generateTimeSlotsInUserTimezone(
    startTime,
    endTime,
    timeGap,
    dateStr,
    timezone
  );

  // Filtrar slots considerando duración del evento
  for (const slotStart of allSlots) {
    // ✅ NUEVO: Filtrar slots que ya pasaron o están demasiado cerca si es hoy
    if (isToday && minimumStartTime) {
      const slotStartMinutes = timeStringToMinutes(slotStart);
      const minimumStartMinutes = timeStringToMinutes(minimumStartTime);
      
      if (slotStartMinutes < minimumStartMinutes) {
        // Agregar al array de slots bloqueados con razón específica
        blockedSlots.push({
          slot: slotStart,
          reason: 'past_time',
          value: 'Slot has passed or is too close to current time',
          timeRange: `Current time + ${Math.max(30, timeGap)} min margin`
        });
        
        console.log(`   ⏰ [TIME_FILTER] Slot ${slotStart} blocked - too close to current time`);
        continue; // Saltar este slot
      }
    }

    // Calcular cuándo terminaría este slot
    const slotStartParts = slotStart.split(':');
    const slotStartMinutes = parseInt(slotStartParts[0]) * 60 + parseInt(slotStartParts[1]);
    const slotEndMinutes = slotStartMinutes + duration;
    const slotEndHours = Math.floor(slotEndMinutes / 60);
    const slotEndMins = slotEndMinutes % 60;
    const slotEnd = `${slotEndHours.toString().padStart(2, '0')}:${slotEndMins.toString().padStart(2, '0')}`;

    // Verificar que el slot completo cabe en horario disponible
    const endTimeParts = endTime.split(':');
    const endTimeMinutes = parseInt(endTimeParts[0]) * 60 + parseInt(endTimeParts[1]);

    if (slotEndMinutes > endTimeMinutes) {
      continue; // Slot no cabe en horario disponible
    }

    // Verificar conflictos
    const conflictCheck = checkSlotConflicts(
      slotStart,
      slotEnd,
      dateStr,
      timezone,
      meetings,
      calendarEvents
    );

    if (!conflictCheck.hasConflict) {
      console.log(`   ✅ [AVAILABLE] Slot ${slotStart}-${slotEnd} is available`);
      availableSlots.push(slotStart);
    } else {
      // ✅ CAPTURAR INFORMACIÓN DEL SLOT BLOQUEADO
      const conflictTitle = conflictCheck.conflictDetail?.title || conflictCheck.conflictDetail?.guestName || 'Unknown';
      const conflictTime = conflictCheck.conflictDetail?.eventTime || conflictCheck.conflictDetail?.meetingTime || 'Unknown time';
      const reason = conflictCheck.conflictDetail?.type === 'meeting' ? 'meeting' : 'calendar';

      // 🔥 AGREGAR AL ARRAY DE SLOTS BLOQUEADOS
      blockedSlots.push({
        slot: slotStart,
        reason: reason,
        value: conflictTitle,
        timeRange: conflictTime
      });

      console.log(`   ❌ [CONFLICT] Slot ${slotStart}-${slotEnd} conflicts with ${conflictCheck.conflictDetail?.type}: "${conflictTitle}" (${conflictTime})`);
    }
  }

  console.log(`✅ [SLOTS] Generated ${availableSlots.length} available slots and ${blockedSlots.length} blocked slots for ${dateStr}`);
  console.log('🚫 [BLOCKED] Blocked slots:', blockedSlots);
  console.log('------------------------------------------------------------------');

  return { availableSlots, blockedSlots };
}

function getNextDateForDay(dayOfWeek: string): Date {
  const days = [
    "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY",
    "THURSDAY", "FRIDAY", "SATURDAY",
  ];

  const today = new Date();
  const todayDay = today.getDay();
  const targetDay = days.indexOf(dayOfWeek);
  const daysUntilTarget = (targetDay - todayDay + 7) % 7;

  return addDays(today, daysUntilTarget);
}

async function determineCalendarProvider(event: Event): Promise<'google' | 'outlook' | 'none'> {
  // console.log('🔍 [CALENDAR_PROVIDER] Determining calendar provider for event:', {
  //   eventId: event.id,
  //   locationType: event.locationType,
  //   calendarId: event.calendar_id
  // });

  const integrationRepository = AppDataSource.getRepository(Integration);

  // 🎯 ESTRATEGIA 1: Basarse en el locationType del evento
  switch (event.locationType) {
    case EventLocationEnumType.GOOGLE_MEET_AND_CALENDAR:
    case EventLocationEnumType.GOOGLE_WITH_ZOOM:
      // console.log('------------------------------------------------------------------');
      console.log('📅 [CALENDAR_PROVIDER] Using Google Calendar based on locationType:', event.locationType);
      return 'google';

    case EventLocationEnumType.OUTLOOK_WITH_ZOOM:
    case EventLocationEnumType.OUTLOOK_WITH_TEAMS:
      console.log('------------------------------------------------------------------');
      console.log('📅 [CALENDAR_PROVIDER] Using Outlook Calendar based on locationType:', event.locationType);
      return 'outlook';
  }

  // 🎯 ESTRATEGIA 2: Verificar qué integraciones tiene el usuario
  const [googleIntegration, outlookIntegration] = await Promise.all([
    integrationRepository.findOne({
      where: {
        userId: event.user.id,
        app_type: IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR,
        isConnected: true
      }
    }),
    integrationRepository.findOne({
      where: {
        userId: event.user.id,
        app_type: IntegrationAppTypeEnum.OUTLOOK_CALENDAR,
        isConnected: true
      }
    })
  ]);

  // 🎯 ESTRATEGIA 3: Si tiene calendar_id específico, intentar determinar por el formato
  if (event.calendar_id) {
    // Los calendar_id de Google suelen ser emails o 'primary'
    if (event.calendar_id === 'primary' || event.calendar_id.includes('@gmail.com') || event.calendar_id.includes('@googlemail.com')) {
      if (googleIntegration) {
        console.log('📅 [CALENDAR_PROVIDER] Using Google Calendar based on calendar_id format:', event.calendar_id);
        return 'google';
      }
    }

    // Los calendar_id de Outlook suelen ser IDs largos o emails de Microsoft
    if (event.calendar_id.includes('@outlook.com') || event.calendar_id.includes('@hotmail.com') || event.calendar_id.includes('@live.com')) {
      if (outlookIntegration) {
        console.log('📅 [CALENDAR_PROVIDER] Using Outlook Calendar based on calendar_id format:', event.calendar_id);
        return 'outlook';
      }
    }
  }

  // 🎯 ESTRATEGIA 4: Priorizar según disponibilidad de integraciones
  if (googleIntegration && !outlookIntegration) {
    console.log('📅 [CALENDAR_PROVIDER] Using Google Calendar (only integration available)');
    return 'google';
  }

  if (outlookIntegration && !googleIntegration) {
    console.log('📅 [CALENDAR_PROVIDER] Using Outlook Calendar (only integration available)');
    return 'outlook';
  }

  if (googleIntegration && outlookIntegration) {
    // Si tiene ambas, priorizar Google por defecto (o usar lógica adicional)
    console.log('📅 [CALENDAR_PROVIDER] Using Google Calendar (both integrations available, defaulting to Google)');
    return 'google';
  }

  console.log('📅 [CALENDAR_PROVIDER] No calendar provider available');
  return 'none';
}

async function getCalendarEventsForEvent(
  event: Event,
  dateStr: string,
  timezone: string
): Promise<Array<{ title: string; start: string; end: string; status: string }>> {

  const calendarProvider = await determineCalendarProvider(event);

  console.log('📅 [CALENDAR_EVENTS] Getting calendar events for provider:', calendarProvider);

  switch (calendarProvider) {
    case 'google':
      return await getGoogleCalendarEventsForEvent(event, dateStr, timezone);

    case 'outlook':
      return await getOutlookCalendarEventsForEvent(event, dateStr, timezone);

    case 'none':
    default:
      console.log('📅 [CALENDAR_EVENTS] No calendar provider available, returning empty events');
      return [];
  }
}

async function getGoogleCalendarEventsForEvent(
  event: Event,
  dateStr: string,
  timezone: string
): Promise<Array<{ title: string; start: string; end: string; status: string }>> {

  console.log('📗 [GOOGLE_CALENDAR] Getting Google Calendar events for event:', event.id);

  try {
    const integrationRepository = AppDataSource.getRepository(Integration);

    const integration = await integrationRepository.findOne({
      where: {
        userId: event.user.id,
        app_type: IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR,
        isConnected: true
      }
    });

    if (!integration) {
      console.log('📗 [GOOGLE_CALENDAR] No Google Calendar integration found');
      return [];
    }

    console.log('✅ [GOOGLE_CALENDAR] Found Google Calendar integration, fetching events...');

    // Validar token
    const validToken = await validateGoogleCalendarToken(
      integration.access_token,
      integration.refresh_token,
      integration.expiry_date
    );

    // Obtener eventos usando la función existente
    const calendarEvents = await getGoogleCalendarEvents(
      validToken,
      event.calendar_id || integration.calendar_id || 'primary',
      dateStr,
      timezone
    );

    // 🔥 OBTENER MEETINGS EXISTENTES PARA FILTRAR DUPLICADOS
    const existingMeetings = await AppDataSource.getRepository(Meeting).find({
      where: {
        user: { id: event.user.id },
        status: MeetingStatus.SCHEDULED, // ✅ CORREGIR: Usar el enum correcto
        // Filtrar meetings del día específico
        startTime: Between(
          new Date(`${dateStr}T00:00:00.000Z`),
          new Date(`${dateStr}T23:59:59.999Z`)
        )
      }
    });

    console.log('📗 [GOOGLE_CALENDAR] Found existing meetings for filtering:', existingMeetings.length);

    // Convertir eventos a formato simplificado
    const eventsInUserTz = calendarEvents
      .filter(calEvent => !calEvent.isAllDay) // Filtrar eventos de todo el día
      .filter(calEvent => {
        // 🔥 FILTRAR eventos que ya están como meetings en BD
        const eventStartUTC = calEvent.startTime;
        const eventEndUTC = calEvent.endTime;

        // Verificar si existe un meeting en BD para el mismo horario
        const isDuplicate = existingMeetings.some(meeting => {
          const meetingStartUTC = meeting.startTime;
          const meetingEndUTC = meeting.endTime;

          // Comparar con tolerancia de ±5 minutos
          const timeDiffStart = Math.abs(eventStartUTC.getTime() - meetingStartUTC.getTime());
          const timeDiffEnd = Math.abs(eventEndUTC.getTime() - meetingEndUTC.getTime());

          const tolerance = 5 * 60 * 1000; // 5 minutos en milliseconds

          return timeDiffStart <= tolerance && timeDiffEnd <= tolerance;
        });

        if (isDuplicate) {
          console.log(`   🔄 [GOOGLE_FILTER] Skipping duplicate event: "${calEvent.title}" (already in meetings DB)`);
          return false;
        }

        return true;
      })
      .map(calEvent => {
        // ✅ CONVERTIR de UTC a timezone del usuario
        const startInUserTz = convertUTCToUserTimezone(calEvent.startTime, timezone);
        const endInUserTz = convertUTCToUserTimezone(calEvent.endTime, timezone);

        return {
          title: calEvent.title,
          start: format(startInUserTz, 'HH:mm'),
          end: format(endInUserTz, 'HH:mm'),
          status: calEvent.status ?? ""
        };
      });

    console.log('📗 [GOOGLE_CALENDAR] Found ' + calendarEvents.length + ' total events, ' + eventsInUserTz.length + ' unique blocking events (after duplicate filtering)');

    // Log de eventos que bloquean
    eventsInUserTz.forEach(calEvent => {
      if (calEvent.status === 'confirmed') {
        console.log(`   ✅ Including Google blocking event: "${calEvent.title}" (${calEvent.status})`);
      }
    });

    return eventsInUserTz;

  } catch (error) {
    console.warn('⚠️ [GOOGLE_CALENDAR] Failed to fetch Google calendar events:', error);
    return [];
  }
}

async function getOutlookCalendarEventsForEvent(
  event: Event,
  dateStr: string,
  timezone: string
): Promise<Array<{ title: string; start: string; end: string; status: string }>> {

  try {
    const integrationRepository = AppDataSource.getRepository(Integration);

    const integration = await integrationRepository.findOne({
      where: {
        userId: event.user.id,
        app_type: IntegrationAppTypeEnum.OUTLOOK_CALENDAR,
        isConnected: true
      }
    });

    if (!integration) {
      console.log('📘 [OUTLOOK_CALENDAR] No Outlook Calendar integration found');
      return [];
    }

    // Validar token de Microsoft
    const validToken = await validateMicrosoftToken(
      integration.access_token,
      integration.refresh_token,
      integration.expiry_date
    );

    // Obtener eventos de Outlook usando la función existente
    const outlookEvents = await getOutlookCalendarEvents(
      validToken,
      event.calendar_id || integration.outlook_calendar_id || 'primary',
      dateStr,
      timezone
    );

    // 🔥 OBTENER MEETINGS EXISTENTES PARA FILTRAR DUPLICADOS
    const existingMeetings = await AppDataSource.getRepository(Meeting).find({
      where: {
        user: { id: event.user.id },
        status: MeetingStatus.SCHEDULED, // ✅ CORREGIR: Usar el enum correcto
        // calendarAppType:event.calendar_id,
        // Filtrar meetings del día específico
        startTime: Between(
          new Date(`${dateStr}T00:00:00.000Z`),
          new Date(`${dateStr}T23:59:59.999Z`)
        )
      }
    });

    console.log('📘 [OUTLOOK_CALENDAR] existing meetings:', existingMeetings);

    // Convertir eventos de Outlook a formato simplificado
    const eventsInUserTz = outlookEvents
      .filter(outlookEvent => !outlookEvent.isAllDay) // Filtrar eventos de todo el día
      .filter(outlookEvent => {
        // 🔥 FILTRAR eventos que ya están como meetings en BD
        const eventStartUTC = outlookEvent.startTime;
        const eventEndUTC = outlookEvent.endTime;

        // Verificar si existe un meeting en BD para el mismo horario
        const isDuplicate = existingMeetings.some(meeting => {
          const meetingStartUTC = meeting.startTime;
          const meetingEndUTC = meeting.endTime;

          // Comparar con tolerancia de ±5 minutos para account for timezone differences
          const timeDiffStart = Math.abs(eventStartUTC.getTime() - meetingStartUTC.getTime());
          const timeDiffEnd = Math.abs(eventEndUTC.getTime() - meetingEndUTC.getTime());

          const tolerance = 5 * 60 * 1000; // 5 minutos en milliseconds

          return timeDiffStart <= tolerance && timeDiffEnd <= tolerance;
        });

        if (isDuplicate) {
          console.log(`   🔄 [OUTLOOK_FILTER] Skipping duplicate event: "${outlookEvent.title}" (already in meetings DB)`);
          return false;
        }

        return true;
      })
      .map(outlookEvent => {
        // 🔧 QUICK FIX: NO convertir timezone - asumir que vienen en timezone local
        let startFormatted, endFormatted;

        if (outlookEvent.startTime instanceof Date) {
          startFormatted = format(outlookEvent.startTime, 'HH:mm');
        } else {
          const startDate = parseISO(outlookEvent.startTime as string);
          startFormatted = format(startDate, 'HH:mm');
        }

        if (outlookEvent.endTime instanceof Date) {
          endFormatted = format(outlookEvent.endTime, 'HH:mm');
        } else {
          const endDate = parseISO(outlookEvent.endTime as string);
          endFormatted = format(endDate, 'HH:mm');
        }

        console.log(`🔧 [OUTLOOK_NO_CONVERSION] "${outlookEvent.title}": ${startFormatted}-${endFormatted}`);

        return {
          title: outlookEvent.title,
          start: startFormatted,
          end: endFormatted,
          status: outlookEvent.status ?? "confirmed"
        };
      });
    
    // // Log de eventos que bloquean
    eventsInUserTz.forEach(outlookEvent => {
      if (outlookEvent.status === 'confirmed') {
        console.log(`   ✅ Including Outlook blocking event: "${outlookEvent.title}" (${outlookEvent.status})`);
      }
    });

    return eventsInUserTz;

  } catch (error) {
    console.warn('⚠️ [OUTLOOK_CALENDAR] Failed to fetch Outlook calendar events:', error);
    return [];
  }
}