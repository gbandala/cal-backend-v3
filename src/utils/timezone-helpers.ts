/**
 * 🌍 TIMEZONE HELPERS - VERSIÓN FINAL SIMPLIFICADA
 * 
 * Utilidades para convertir entre UTC y timezone del usuario
 * Versión optimizada para trabajar con las funciones existentes de Google Calendar
 */

import { format, parseISO, addMinutes } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

/**
 * Convierte fecha UTC a timezone del usuario
 */
export function convertUTCToUserTimezone(
  utcDate: Date | string, 
  timezone: string
): Date {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return toZonedTime(date, timezone);
}

/**
 * Convierte fecha del timezone del usuario a UTC
 */
export function convertUserTimezoneToUTC(
  userDate: Date, 
  timezone: string
): Date {
  return fromZonedTime(userDate, timezone);
}

/**
 * Convierte eventos de BD (UTC) a timezone del usuario
 */
export function convertMeetingsToUserTimezone(
  meetings: { startTime: Date; endTime: Date; status: string }[], 
  timezone: string
) {
  return meetings.map(meeting => ({
    ...meeting,
    startTime: convertUTCToUserTimezone(meeting.startTime, timezone),
    endTime: convertUTCToUserTimezone(meeting.endTime, timezone),
  }));
}

/**
 * Crea un Date object para una hora específica en el timezone del usuario
 */
export function createDateInUserTimezone(
  dateStr: string, 
  timeStr: string, 
  timezone: string
): Date {
  const localDateStr = `${dateStr}T${timeStr}:00`;
  const localDate = parseISO(localDateStr);
  return convertUserTimezoneToUTC(localDate, timezone);
}

/**
 * Genera array de slots de tiempo en timezone del usuario
 */
export function generateTimeSlotsInUserTimezone(
  startTime: string,
  endTime: string, 
  timeGap: number,
  dateStr: string,
  timezone: string
): string[] {
  const slots: string[] = [];
  
  // Crear fechas en timezone del usuario
  let currentSlot = createDateInUserTimezone(dateStr, startTime, timezone);
  const endSlot = createDateInUserTimezone(dateStr, endTime, timezone);
  
  while (currentSlot < endSlot) {
    // Convertir de vuelta a timezone del usuario para display
    const slotInUserTz = convertUTCToUserTimezone(currentSlot, timezone);
    slots.push(format(slotInUserTz, 'HH:mm'));
    
    // Avanzar al siguiente slot
    currentSlot = addMinutes(currentSlot, timeGap);
  }
  
  return slots;
}

/**
 * Verifica si hay conflicto entre un slot y eventos existentes
 * VERSIÓN SIMPLIFICADA que maneja ambos tipos de eventos
 */
export function checkSlotConflicts(
  slotStart: string,
  slotEnd: string,
  dateStr: string,
  timezone: string,
  meetings: Array<{ startTime: Date; endTime: Date; guestName?: string; status: string }>,
  calendarEvents: Array<{ start: string; end: string; title: string; status: string }>
) {
  // Convertir slot a Date objects para comparación con meetings
  const slotStartDate = createDateInUserTimezone(dateStr, slotStart, timezone);
  const slotEndDate = createDateInUserTimezone(dateStr, slotEnd, timezone);
  
  // Verificar conflictos con meetings de BD (ya convertidas a timezone del usuario)
  for (const meeting of meetings) {
    if (meeting.status === 'SCHEDULED' && 
        slotStartDate < meeting.endTime && 
        slotEndDate > meeting.startTime) {
      return {
        hasConflict: true,
        conflictDetail: {
          type: 'meeting',
          guestName: meeting.guestName,
          meetingTime: `${format(meeting.startTime, 'HH:mm')}-${format(meeting.endTime, 'HH:mm')}`
        }
      };
    }
  }
  
  // Verificar conflictos con eventos de calendario (ya en formato HH:mm)
  for (const event of calendarEvents) {
    if (event.status === 'confirmed') {
      // Comparar directamente las horas como strings
      if (timeRangesOverlap(slotStart, slotEnd, event.start, event.end)) {
        return {
          hasConflict: true,
          conflictDetail: {
            type: 'calendar',
            title: event.title,
            eventTime: `${event.start}-${event.end}`
          }
        };
      }
    }
  }
  
  return { hasConflict: false };
}

/**
 * Helper: Verifica si dos rangos de tiempo se solapan
 */
function timeRangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  // Convertir HH:mm a minutos desde medianoche para comparación
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  
  const start1Min = timeToMinutes(start1);
  const end1Min = timeToMinutes(end1);
  const start2Min = timeToMinutes(start2);
  const end2Min = timeToMinutes(end2);
  
  // Los rangos se solapan si start1 < end2 && end1 > start2
  return start1Min < end2Min && end1Min > start2Min;
}