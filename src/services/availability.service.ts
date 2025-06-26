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
import { addDays, format, parseISO } from "date-fns";

// 🔥 IMPORTS: Timezone helpers y funciones de Google Calendar
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

/**
 * ✅ SIN CAMBIOS - Obtener disponibilidad de un usuario específico
 */
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

/**
 * ✅ SIN CAMBIOS - Actualizar configuración de disponibilidad
 */
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

/**
 * 🔥 FUNCIÓN PRINCIPAL CORREGIDA - Obtener disponibilidad para evento público
 */
export const getAvailabilityForPublicEventService = async (
  eventId: string,
  timezone: string = 'UTC',
  date?: string
) => {
  console.log('🌍 [AVAILABILITY] Getting availability with timezone support:', {
    eventId,
    timezone,
    date
  });

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

    console.log('✅ [AVAILABILITY] Event and availability found');

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

        console.log(`🔍 [AVAILABILITY] Processing ${dayOfWeek} (${dateStr})`);

        // 4. Convertir meetings de BD a timezone del usuario
        const meetingsInUserTz = convertMeetingsToUserTimezone(
          meetings.filter(m => m.status === 'SCHEDULED'),
          timezone
        );

        console.log('📅 [AVAILABILITY] Meetings converted to user timezone:', {
          originalCount: meetings.length,
          filteredCount: meetingsInUserTz.length,
          timezone
        });

        // 5. Obtener y procesar eventos de Google Calendar
        let calendarEventsInUserTz: Array<{
          title: string;
          start: string;
          end: string;
          status: string;
        }> = [];

        try {
          // Obtener integración de Google Calendar
          const integrationRepository = AppDataSource.getRepository(Integration);
          const integration = await integrationRepository.findOne({
            where: {
              userId: event.user.id,
              app_type: IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR,
              isConnected: true
            }
          });

          if (integration) {
            console.log('🔍 [AVAILABILITY_SERVICE] Looking for calendar integrations for user:', event.user.id);
            console.log('✅ [AVAILABILITY_SERVICE] Found Google Calendar integration, fetching events...');

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

            // Convertir eventos a formato simplificado (ya vienen en timezone correcto)
            // calendarEventsInUserTz = calendarEvents
            //   .filter(calEvent => !calEvent.isAllDay) // Filtrar eventos de todo el día
            //   .map(calEvent => ({
            //     title: calEvent.title,
            //     start: format(calEvent.startTime, 'HH:mm'),
            //     end: format(calEvent.endTime, 'HH:mm'),
            //     status: calEvent.status ?? ""
            //   }));

            calendarEventsInUserTz = calendarEvents
              .filter(calEvent => !calEvent.isAllDay) // Filtrar eventos de todo el día
              .map(calEvent => {
                // ✅ CONVERTIR de UTC a timezone del usuario
                const startInUserTz = convertUTCToUserTimezone(calEvent.startTime, timezone);
                const endInUserTz = convertUTCToUserTimezone(calEvent.endTime, timezone);

                return {
                  title: calEvent.title,
                  start: format(startInUserTz, 'HH:mm'), // ✅ Ahora será 09:00 en lugar de 15:00
                  end: format(endInUserTz, 'HH:mm'),     // ✅ Ahora será 10:00 en lugar de 16:00
                  status: calEvent.status ?? ""
                };
              });
            console.log('📅 [AVAILABILITY] Found ' + calendarEvents.length + ' blocking calendar events for ' + dayOfWeek + ':', calendarEventsInUserTz);

            // Log de eventos que bloquean
            calendarEventsInUserTz.forEach(calEvent => {
              if (calEvent.status === 'confirmed') {
                console.log(`   ✅ Including blocking event: "${calEvent.title}" (${calEvent.status})`);
              }
            });

          } else {
            console.log('🔍 [AVAILABILITY_SERVICE] No Google Calendar integration found');
          }

        } catch (calendarError) {
          console.warn('⚠️ [AVAILABILITY] Failed to fetch calendar events:', calendarError);
        }

        // 6. Generar slots en timezone del usuario
        const slots = generateAvailableTimeSlotsWithTimezone(
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
          slots,
          isAvailable: true,
          debug: {
            totalCalendarEvents: calendarEventsInUserTz.length,
            blockingCalendarEvents: calendarEventsInUserTz.filter(e => e.status === 'confirmed').length,
            meetingsCount: meetingsInUserTz.length,
            calendarId: event.calendar_id
          }
        });
      }
    }

    console.log("✅ [AVAILABILITY] Final available days:", availableDays.length);
    return availableDays;

  } catch (error) {
    console.error('❌ [AVAILABILITY] Error:', error);
    return [];
  }
};

/**
 * 🔥 FUNCIÓN CORREGIDA - Generar slots con manejo correcto de timezone
 */
function generateAvailableTimeSlotsWithTimezone(
  startTime: string,        // "09:00"
  endTime: string,          // "17:00"
  duration: number,         // 60 minutos
  meetings: Array<{ startTime: Date; endTime: Date; guestName?: string; status: string }>,
  calendarEvents: Array<{ start: string; end: string; title: string; status: string }>,
  dateStr: string,          // "2025-06-27"
  timeGap: number = 30,
  timezone: string
): string[] {

  console.log('🔍 [SLOTS] Generating slots for ' + dateStr + ':', {
    startTime,
    endTime,
    duration: duration + 'min',
    timeGap: timeGap + 'min',
    meetingsCount: meetings.length,
    calendarEventsCount: calendarEvents.length,
    isToday: format(new Date(), 'yyyy-MM-dd') === dateStr
  });

  const availableSlots: string[] = [];

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
      console.log(`   ❌ [CONFLICT] Slot ${slotStart}-${slotEnd} conflicts with ${conflictCheck.conflictDetail?.type}:`, conflictCheck.conflictDetail);
    }
  }

  console.log(`✅ [SLOTS] Generated ${availableSlots.length} available slots for ${dateStr}:`, availableSlots);
  return availableSlots;
}

/**
 * ✅ FUNCIÓN HELPER SIN CAMBIOS - Calcular próxima fecha para un día específico
 */
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