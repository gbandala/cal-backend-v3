import { AvailabilityResponseType } from "../@types/availability.type";
import { AppDataSource } from "../config/database.config";
import { User } from "../database/entities/user.entity";
import { NotFoundException } from "../utils/app-error";
import { UpdateAvailabilityDto } from "../database/dto/availability.dto";
import { Availability } from "../database/entities/availability.entity";
import { DayOfWeekEnum } from "../database/entities/day-availability";
import { Event } from "../database/entities/event.entity";
import { addDays, addMinutes, format, parseISO } from "date-fns";


/**
 * SERVICIO: Obtener disponibilidad de un usuario específico
 * 
 * @param userId - ID único del usuario
 * @returns AvailabilityResponseType - Objeto con timeGap y días de disponibilidad
 * 
 * FLUJO:
 * 1. Busca usuario en BD con relaciones de disponibilidad
 * 2. Valida existencia del usuario y su configuración
 * 3. Formatea los horarios de Date a string HH:mm
 * 4. Retorna estructura normalizada
 */
export const getUserAvailabilityService = async (userId: string, timezone: string = 'UTC') => {
  // Obtener repositorio de usuarios desde la fuente de datos
  const userRepository = AppDataSource.getRepository(User);

  // Buscar usuario con sus relaciones anidadas (availability -> days)
  const user = await userRepository.findOne({
    where: { id: userId },
    relations: ["availability", "availability.days"], // Eager loading de relaciones
  });

  // Validación: usuario debe existir y tener disponibilidad configurada
  if (!user || !user.availability) {
    console.log("User not found or availability not set:", userId);
    throw new NotFoundException("User not found or availbility"); // Typo en original: "availbility"
  }

  // Inicializar estructura de respuesta
  const availabilityData: AvailabilityResponseType = {
    timeGap: user.availability.timeGap, // Intervalo entre citas en minutos
    days: [],
  };

  // Procesar cada día de disponibilidad y convertir a zona horaria del usuario
  user.availability.days.forEach((dayAvailability) => {
    availabilityData.days.push({
      day: dayAvailability.day,
      // Convertir UTC a zona horaria del usuario para visualización
      // startTime: formatInTimeZone(dayAvailability.startTime, timezone, 'HH:mm'),
      // endTime: formatInTimeZone(dayAvailability.endTime, timezone, 'HH:mm'),
      startTime: dayAvailability.startTime.slice(0, 5),
      endTime: dayAvailability.endTime.slice(0, 5),
      isAvailable: dayAvailability.isAvailable,
    });
  });
  console.log("User availability data:", availabilityData);
  return availabilityData;
};

/**
 * SERVICIO: Actualizar configuración de disponibilidad de un usuario
 * 
 * @param userId - ID único del usuario
 * @param data - DTO con nueva configuración de disponibilidad
 * @returns Objeto con confirmación de éxito
 * 
 * FLUJO:
 * 1. Busca usuario existente
 * 2. Valida que exista
 * 3. Transforma datos de entrada (string time -> Date objects)
 * 4. Actualiza en base de datos
 * 5. Retorna confirmación
 */
export const updateAvailabilityService = async (
  userId: string,
  data: UpdateAvailabilityDto,
  timezone: string = 'UTC' // Nuevo parámetro opcional
) => {
  const userRepository = AppDataSource.getRepository(User);
  const availabilityRepository = AppDataSource.getRepository(Availability);

  // Buscar usuario con disponibilidad actual
  const user = await userRepository.findOne({
    where: { id: userId },
    relations: ["availability", "availability.days"],
  });

  // Validación: usuario debe existir
  if (!user) {
    console.log("User not found:", userId);
    throw new NotFoundException("User not found");
  }

  // Transformar datos: convertir strings de tiempo a objetos Date en UTC
  const dayAvailabilityData = data.days.map(
    ({ day, isAvailable, startTime, endTime }) => {
      // Base date es irrelevante para almacenamiento UTC
      return {
        day: day.toUpperCase() as DayOfWeekEnum,
        // Crear Date objects en UTC directamente
        // startTime: toZonedTime(parseISO(`2000-01-01T${startTime}:00`), timezone),
        // endTime: toZonedTime(parseISO(`2000-01-01T${endTime}:00`), timezone),
        startTime: startTime,
        endTime: endTime,
        isAvailable,
      };
    }
  );

  // Actualizar solo si el usuario ya tiene configuración de disponibilidad
  if (user.availability) {
    await availabilityRepository.save({
      id: user.availability.id, // Mantener ID existente para UPDATE
      timeGap: data.timeGap, // Nuevo intervalo entre citas
      // Mapear días con referencia a la entidad availability padre
      days: dayAvailabilityData.map((day) => ({
        ...day,
        availability: { id: user.availability.id }, // Relación FK
      })),
    });
  }

  return { sucess: true }; // Typo en original: "sucess"
};

/**
 * SERVICIO: Generar slots de tiempo disponibles para un evento público
 * 
 * @param eventId - ID del evento público
 * @returns Array de días con sus slots disponibles
 * 
 * FLUJO COMPLEJO:
 * 1. Busca evento público con todas las relaciones necesarias
 * 2. Valida que existe y tiene disponibilidad configurada
 * 3. Para cada día de la semana:
 *    a. Calcula próxima fecha de ese día
 *    b. Busca configuración de disponibilidad para ese día
 *    c. Genera slots considerando reuniones existentes
 * 4. Retorna estructura con días y slots disponibles
 */
export const getAvailabilityForPublicEventService = async (
  eventId: string,
  timezone: string = 'UTC',
  date?: string
) => {

  console.log('informacion de evento:', eventId, timezone, date);

  const eventRepository = AppDataSource.getRepository(Event);

  try {
    // Buscar evento con TODAS las relaciones necesarias para el cálculo
    const event = await eventRepository.findOne({
      where: { id: eventId, isPrivate: false }, // Solo eventos públicos
      relations: [
        "user",                    // Dueño del evento
        "user.availability",       // Configuración de disponibilidad del dueño
        "user.availability.days",  // Días específicos de disponibilidad
        "user.meetings",           // Reuniones ya programadas (para evitar conflictos)
      ],
    });
    // Validación temprana: evento debe existir y tener disponibilidad
    if (!event || !event.user.availability) return [];

    console.log('Evento:', event);

    // Extraer datos necesarios
    const { availability, meetings } = event.user;
    const daysOfWeek = Object.values(DayOfWeekEnum); // Todos los días de la semana
    const availableDays = [];

    // Si se proporciona una fecha específica, filtrar solo ese día
    let targetDate: Date | null = null;
    let targetDayOfWeek: string | null = null;

    if (date) {
      targetDate = parseISO(date);
      // Obtener el día de la semana de la fecha proporcionada
      targetDayOfWeek = format(targetDate, 'EEEE').toUpperCase();
      // Filtrar solo para procesar el día de la semana de la fecha específica
      daysOfWeek.length = 0; // Vaciar el array
      daysOfWeek.push(targetDayOfWeek as DayOfWeekEnum);
    }

    // BUCLE PRINCIPAL: Procesar cada día de la semana
    for (const dayOfWeek of daysOfWeek) {
      // Calcular la fecha correcta para este día
      // Si tenemos una fecha específica, usamos esa en lugar de calcular la próxima
      const dayDate = targetDate || getNextDateForDay(dayOfWeek);

      // Buscar si este día tiene configuración de disponibilidad
      const dayAvailability = availability.days.find((d) => d.day === dayOfWeek);
      console.log('dayAvailability', dayAvailability);

      if (dayAvailability) {
        // Generar slots solo si el día está marcado como disponible
        const slots = dayAvailability.isAvailable
          ? generateAvailableTimeSlots(
            dayAvailability.startTime,  // Hora inicio del día
            dayAvailability.endTime,    // Hora fin del día
            event.duration,             // Duración del evento en minutos
            meetings,                   // Reuniones existentes para evitar conflictos
            format(dayDate, "yyyy-MM-dd"),
            availability.timeGap,        // Intervalo entre citas
            timezone
          )
          : []; // Array vacío si el día no está disponible

        // Agregar día procesado a resultado
        availableDays.push({
          day: dayOfWeek,
          date: format(dayDate, "yyyy-MM-dd"), // Incluir la fecha explícitamente
          slots,
          isAvailable: dayAvailability.isAvailable,
        });
      }
    }
    console.log("Lista de dias disponibles:", availableDays);
    return availableDays;
  } catch (error) {
    console.error('Error en getAvailabilityForPublicEventService :', error);
  }

};

/**
 * FUNCIÓN AUXILIAR: Calcular próxima fecha para un día específico de la semana
 * 
 * @param dayOfWeek - Día de la semana como string (ej: "MONDAY")
 * @returns Date object de la próxima ocurrencia de ese día
 * 
 * ALGORITMO:
 * - Si es el mismo día de hoy: retorna hoy
 * - Si no: calcula cuántos días faltan hasta la próxima ocurrencia
 */
function getNextDateForDay(dayOfWeek: string): Date {
  // Mapeo de días: índice del array = número del día (0 = Domingo)
  const days = [
    "SUNDAY",    // 0
    "MONDAY",    // 1
    "TUESDAY",   // 2
    "WEDNESDAY", // 3
    "THURSDAY",  // 4
    "FRIDAY",    // 5
    "SATURDAY",  // 6
  ];

  const today = new Date();
  const todayDay = today.getDay(); // 0-6, donde 0 = Domingo

  const targetDay = days.indexOf(dayOfWeek); // Encontrar índice del día objetivo

  // CÁLCULO: Días hasta el próximo día objetivo
  // Ejemplos:
  // - Hoy Lunes (1), objetivo Lunes (1): (1-1+7)%7 = 0 días (hoy)
  // - Hoy Lunes (1), objetivo Viernes (5): (5-1+7)%7 = 4 días
  // - Hoy Viernes (5), objetivo Lunes (1): (1-5+7)%7 = 3 días
  const daysUntilTarget = (targetDay - todayDay + 7) % 7;

  return addDays(today, daysUntilTarget);
}

/**
 * FUNCIÓN AUXILIAR: Generar todos los slots de tiempo disponibles para un día
 * 
 * @param startTime - Hora de inicio de disponibilidad
 * @param endTime - Hora de fin de disponibilidad  
 * @param duration - Duración del evento en minutos
 * @param meetings - Array de reuniones existentes
 * @param dateStr - Fecha como string YYYY-MM-DD
 * @param timeGap - Intervalo entre slots en minutos (default 30)
 * @returns Array de strings con horarios disponibles en formato HH:mm
 * 
 * ALGORITMO:
 * 1. Crear fecha completa combinando dateStr + horarios
 * 2. Iterar desde startTime hasta endTime en intervalos de timeGap
 * 3. Para cada slot: verificar que no haya conflictos y no sea en el pasado
 * 4. Agregar slots válidos al array resultado
 */
function generateAvailableTimeSlots(
  startTime: string,
  endTime: string,
  duration: number,
  // meetings: { startTime: Date; endTime: Date }[],
  meetings: { startTime: Date; endTime: Date; status: string }[], // ✅ Agregar status
  dateStr: string,
  timeGap: number = 30,
  timezone: string = 'UTC'
) {
  const slots = [];
  // console.log('startTime>', startTime);
  // console.log('endTime>', endTime);
  // console.log('dateStr:', dateStr);

  try {

    let slotStartTime = parseISO(`${dateStr}T${startTime.slice(0, 5)}`);
    let slotEndTime = parseISO(`${dateStr}T${endTime.slice(0, 5)}`);

    // console.log('startTime:', startTime);
    // console.log('endTime:', endTime);

    const now = new Date();
    const isToday = format(now, "yyyy-MM-dd") === dateStr; // Verificar si es hoy

    // BUCLE: Generar slots desde inicio hasta fin
    while (slotStartTime < slotEndTime) {
      // VALIDACIÓN 1: No permitir slots en el pasado
      if (!isToday || slotStartTime >= now) {
        // Calcular cuándo terminaría este slot específico
        const slotEnd = new Date(slotStartTime.getTime() + duration * 60000);

        // VALIDACIÓN 2: Verificar que no hay conflicto con reuniones existentes
        if (isSlotAvailable(slotStartTime, slotEnd, meetings)) {
          // Slot válido: agregar solo la hora en formato HH:mm
          slots.push(format(slotStartTime, "HH:mm"));
          // slots.push(formatInTimeZone(slotStartTime, timezone, "HH:mm"));
          // slots.push(slotStartTime);
        }
        // slots.push(slotStartTime);
      }

      // Avanzar al siguiente slot según el intervalo configurado
      slotStartTime = addMinutes(slotStartTime, timeGap);
    }

    return slots;
  } catch (error) {

    console.log('Error en : generateAvailableTimeSlots', error)
  }

}

/**
 * FUNCIÓN AUXILIAR: Verificar si un slot de tiempo está disponible
 * 
 * @param slotStart - Hora de inicio del slot
 * @param slotEnd - Hora de fin del slot
 * @param meetings - Array de reuniones existentes
 * @returns boolean - true si el slot está disponible, false si hay conflicto
 * 
 * ALGORITMO:
 * 1. Iterar sobre cada reunión existente
 * 2. Verificar si el slot se solapa con alguna reunión programada
 * 3. Retornar false si hay conflicto, true si no hay conflictos
 */
function isSlotAvailable(
  slotStart: Date,
  slotEnd: Date,
  meetings: { startTime: Date; endTime: Date; status: string }[] // ✅ Agregar status
): boolean {
  try {
    for (const meeting of meetings) {
      // ✅ Solo considerar reuniones programadas (SCHEDULED)
      if (meeting.status === 'SCHEDULED' &&
        slotStart < meeting.endTime &&
        slotEnd > meeting.startTime) {
        return false; // Conflicto detectado con reunión activa
      }
    }
    return true; // Sin conflictos: slot disponible
  } catch (error) {
    console.log('Error en isSlotAvailable', error);
    return false;
  }
}