import { AppDataSource } from "../config/database.config";
import { CreateEventDto, UserNameAndSlugDTO } from "../database/dto/event.dto";
import {
  Event,
  EventLocationEnumType,
} from "../database/entities/event.entity";
import { User } from "../database/entities/user.entity";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import { slugify } from "../utils/helper";
import { Meeting } from "../database/entities/meeting.entity";
import { MeetingStatus } from "../enums/meeting.enum";
import { cancelMeetingService } from "./meeting.service"; // Importar servicio de cancelación de reuniones
import { 
  Integration, 
  IntegrationAppTypeEnum 
} from "../database/entities/integration.entity";

/**
 * SERVICIO PRINCIPAL: Crear nuevo evento
 * 
 * @param userId - ID del usuario propietario del evento
 * @param createEventDto - DTO con datos del evento (title, description, duration, etc.)
 * @returns Event - Evento creado y persistido
 * 
 * FLUJO DE CREACIÓN:
 * 1. Validar tipo de ubicación contra enum permitido
 * 2. Generar slug SEO-friendly desde el título
 * 3. Crear entidad con relación al usuario
 * 4. Persistir en base de datos
 * 5. Retornar evento completo
 */
// export const createEventService = async (
//   userId: string,
//   createEventDto: CreateEventDto
// ) => {

//   console.log('------------------------------------------------------------');
//   console.log("Creating event for user:", userId, createEventDto);
//   console.log('------------------------------------------------------------');
//   const eventRepository = AppDataSource.getRepository(Event);
//   // console.log("Event repository initialized", eventRepository.metadata);

//   // VALIDACIÓN: Verificar que el tipo de ubicación sea válido
//   // EventLocationEnumType contiene valores como: "ONLINE", "IN_PERSON", "PHONE", etc.
//   if (
//     !Object.values(EventLocationEnumType)?.includes(createEventDto.locationType)
//   ) {
//     throw new BadRequestException("Invalid location type");
//   }

//     // ✅ NUEVO: Manejar calendar_id para todas las plataformas
//   let finalCalendarId: string | null = null;
//   let finalCalendarName: string | null = null;

//   // GENERACIÓN DE SLUG: Convertir título a URL amigable
//   // Ejemplo: "Consultoría de Marketing" → "consultoria-marketing"
//   // slugify() remueve acentos, espacios, caracteres especiales
//   const slug = slugify(createEventDto.title);
//   // console.log("Generated slug:", slug);

//   // CREACIÓN DE ENTIDAD: Combinar DTO + datos generados + relación
//   const event = eventRepository.create({
//     ...createEventDto,        // Spread de todos los campos del DTO
//     slug,                     // Slug generado automáticamente
//     user: { id: userId },     // Relación con el usuario propietario
//     calendar_id: finalCalendarId,      // 🔥 CALENDARIO ESPECÍFICO
//     calendar_name: finalCalendarName,  // 🔥 NOMBRE DEL CALENDARIO
//   });

//   // PERSISTENCIA: Guardar en base de datos
//   await eventRepository.save(event);
//     console.log("✅ Event created successfully:", {
//     eventId: event.id,
//     title: event.title,
//     locationType: event.locationType,
//     calendarId: event.calendar_id,
//     calendarName: event.calendar_name,
//     userSelected: !!createEventDto.calendar_id
//   });
//   // RETORNO: Evento completo con ID generado
//   return event;
// };

/**
 * SERVICIO PRINCIPAL: Crear nuevo evento con calendario específico
 * 
 * @param userId - ID del usuario propietario del evento
 * @param createEventDto - DTO con datos del evento (title, description, duration, etc.)
 * @returns Event - Evento creado y persistido
 */
export const createEventService = async (
  userId: string,
  createEventDto: CreateEventDto
) => {
  console.log('------------------------------------------------------------');
  console.log("Creating event for user:", userId, createEventDto);
  console.log('------------------------------------------------------------');

  const eventRepository = AppDataSource.getRepository(Event);

  // VALIDACIÓN: Verificar que el tipo de ubicación sea válido
  if (!Object.values(EventLocationEnumType)?.includes(createEventDto.locationType)) {
    throw new BadRequestException("Invalid location type");
  }

  // ✅ LÓGICA PARA DETERMINAR CALENDARIO A USAR
  let finalCalendarId: string = 'primary'; // Default fallback
  let finalCalendarName: string | null = null;

  // Si el usuario seleccionó un calendario específico, usarlo
  if (createEventDto.calendar_id && createEventDto.calendar_id.trim() !== '') {
    console.log("📅 Using user-selected calendar:", createEventDto.calendar_id);
    finalCalendarId = createEventDto.calendar_id;
    finalCalendarName = createEventDto.calendar_name || createEventDto.calendar_id;
  } else {
    // No se seleccionó calendario específico - usar comportamiento por defecto
    console.log("📅 No specific calendar selected, determining default...");

    if (createEventDto.locationType === EventLocationEnumType.GOOGLE_MEET_AND_CALENDAR) {
      // Para Google Meet, intentar obtener el calendario de la integración
      try {
        const integrationRepository = AppDataSource.getRepository(Integration);
        const googleIntegration = await integrationRepository.findOne({
          where: {
            userId: userId,
            app_type: IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR,
            isConnected: true
          }
        });

        if (googleIntegration && googleIntegration.calendar_id) {
          finalCalendarId = googleIntegration.calendar_id;
          finalCalendarName = googleIntegration.calendar_name || 'Google Calendar';
          console.log("📅 Using Google integration calendar:", finalCalendarId);
        } else {
          finalCalendarId = 'primary';
          finalCalendarName = 'Primary Calendar';
          console.log("📅 No Google integration found, using primary calendar");
        }
      } catch (error) {
        console.warn("⚠️ Error fetching Google integration, using primary calendar:", error);
        finalCalendarId = 'primary';
        finalCalendarName = 'Primary Calendar';
      }
    } else {
      // Para Zoom y otras plataformas, usar primary calendar por defecto
      finalCalendarId = 'primary';
      finalCalendarName = 'Primary Calendar';
      console.log("📅 Using primary calendar for platform:", createEventDto.locationType);
    }
  }

  // GENERACIÓN DE SLUG: Convertir título a URL amigable
  const slug = slugify(createEventDto.title);

  // ✅ CREACIÓN DE ENTIDAD: Combinar DTO + datos generados + relación + calendario
  const event = eventRepository.create({
    title: createEventDto.title,
    description: createEventDto.description,
    duration: createEventDto.duration,
    locationType: createEventDto.locationType,
    slug,                           // Slug generado automáticamente
    user: { id: userId },           // Relación con el usuario propietario
    calendar_id: finalCalendarId,   // 🔥 CALENDARIO ESPECÍFICO (siempre tiene valor)
    calendar_name: finalCalendarName, // 🔥 NOMBRE DEL CALENDARIO
  });

  // PERSISTENCIA: Guardar en base de datos
  await eventRepository.save(event);

  console.log("✅ Event created successfully:", {
    eventId: event.id,
    title: event.title,
    locationType: event.locationType,
    calendarId: event.calendar_id,
    calendarName: event.calendar_name,
    userSelected: !!createEventDto.calendar_id
  });

  return event;
};

/**
 * SERVICIO: Obtener todos los eventos de un usuario con métricas
 * 
 * @param userId - ID del usuario propietario
 * @returns Objeto con eventos del usuario + información adicional
 * 
 * CARACTERÍSTICAS ESPECIALES:
 * - Incluye conteo de reuniones por evento (métrica de uso)
 * - Ordenado por fecha de creación (más recientes primero)
 * - Incluye información del usuario para contexto
 */
export const getUserEventsService = async (userId: string) => {
  const userRepository = AppDataSource.getRepository(User);

  // CONSULTA COMPLEJA: Query builder para consulta optimizada con métricas
  const user = await userRepository
    .createQueryBuilder("user")
    // LEFT JOIN para incluir eventos (pueden ser 0)
    .leftJoinAndSelect("user.events", "event")
    // MÉTRICA: Contar reuniones por evento sin hacer queries adicionales
    .loadRelationCountAndMap("event._count.meetings", "event.meetings")
    // FILTRO: Solo eventos del usuario específico
    .where("user.id = :userId", { userId })
    // ORDENAMIENTO: Eventos más recientes primero
    .orderBy("event.createdAt", "DESC")
    .getOne(); // Retorna un solo usuario con sus eventos

  // VALIDACIÓN: Usuario debe existir
  if (!user) {
    throw new NotFoundException("User not found");
  }

  console.log("User events retrieved:", user.events.length);
  // RESPUESTA ESTRUCTURADA: Eventos + contexto del usuario
  return {
    events: user.events,       // Array de eventos con métricas incluidas
    username: user.username,   // Username para contexto en UI
  };
};

/**
 * SERVICIO: Cambiar privacidad de un evento (público ↔ privado)
 * 
 * @param userId - ID del usuario propietario
 * @param eventId - ID del evento a modificar
 * @returns Event - Evento con privacidad actualizada
 * 
 * SEGURIDAD:
 * - Solo el propietario puede cambiar la privacidad
 * - Validación estricta de propiedad antes de modificar
 */
export const toggleEventPrivacyService = async (
  userId: string,
  eventId: string
) => {
  const eventRepository = AppDataSource.getRepository(Event);

  // BÚSQUEDA SEGURA: Evento debe existir Y pertenecer al usuario
  const event = await eventRepository.findOne({
    where: {
      id: eventId,           // Evento específico
      user: { id: userId }   // QUE PERTENEZCA al usuario (seguridad)
    },
  });

  // VALIDACIÓN: Evento debe existir y ser del usuario correcto
  if (!event) {
    throw new NotFoundException("Event not found");
  }

  // TOGGLE: Invertir estado de privacidad
  // true → false (privado → público)
  // false → true (público → privado)
  event.isPrivate = !event.isPrivate;

  // PERSISTENCIA: Guardar cambio
  await eventRepository.save(event);
  console.log("Event privacy toggled:", event.id, event.isPrivate);
  // RETORNO: Evento actualizado
  return event;
};

/**
 * SERVICIO PÚBLICO: Obtener eventos públicos de un usuario específico
 * 
 * @param username - Username del usuario (para URL pública)
 * @returns Objeto con información del usuario + sus eventos públicos
 * 
 * USO: Página pública de perfil donde visitantes ven eventos disponibles
 * EJEMPLO: GET /api/public/users/juanperez123abc/events
 */
export const getPublicEventsByUsernameService = async (username: string) => {
  const userRepository = AppDataSource.getRepository(User);

  // CONSULTA PÚBLICA: Solo datos no sensibles + eventos públicos
  const user = await userRepository
    .createQueryBuilder("user")
    // JOIN CONDICIONAL: Solo eventos públicos (isPrivate = false)
    .leftJoinAndSelect("user.events", "event", "event.isPrivate = :isPrivate", {
      isPrivate: false,
    })
    // FILTRO: Buscar por username (público, no por ID)
    .where("user.username = :username", { username })
    // SELECCIÓN RESTRICTIVA: Solo campos públicos del usuario
    .select(["user.id", "user.name", "user.imageUrl"])
    // CAMPOS DEL EVENTO: Información necesaria para mostrar lista
    .addSelect([
      "event.id",
      "event.title",
      "event.description",
      "event.slug",
      "event.duration",
      "event.locationType",
    ])
    // ORDEN: Eventos más recientes primero
    .orderBy("event.createdAt", "DESC")
    .getOne();

  // VALIDACIÓN: Usuario debe existir
  if (!user) {
    console.log("User not found:", username);
    throw new NotFoundException("User not found");
  }

  console.log("Public events retrieved for user:", username, user.events.length);
  // RESPUESTA PÚBLICA: Datos mínimos + eventos disponibles
  return {
    user: {
      name: user.name,         // Nombre público
      username: username,      // Username para URLs
      imageUrl: user.imageUrl, // Avatar/foto de perfil
    },
    events: user.events,       // Solo eventos públicos
  };
};

/**
 * SERVICIO PÚBLICO: Obtener evento específico por username + slug
 * 
 * @param userNameAndSlugDto - DTO con username y slug del evento
 * @returns Event|null - Evento específico si es público
 * 
 * USO: Página de detalle/reserva de evento específico
 * EJEMPLO: GET /api/public/juanperez123abc/consultoria-marketing
 * 
 * CARACTERÍSTICAS:
 * - URL amigable y SEO-optimizada
 * - Solo eventos públicos son accesibles
 * - Incluye datos mínimos del propietario
 */
export const getPublicEventByUsernameAndSlugService = async (
  userNameAndSlugDto: UserNameAndSlugDTO
) => {
  const { username, slug } = userNameAndSlugDto;
  const eventRepository = AppDataSource.getRepository(Event);

  // CONSULTA ESPECÍFICA: Buscar por combinación username + slug
  const event = await eventRepository
    .createQueryBuilder("event")
    // JOIN: Necesitamos datos del usuario propietario
    .leftJoinAndSelect("event.user", "user")
    // FILTRO 1: Usuario por username
    .where("user.username = :username", { username })
    // FILTRO 2: Evento por slug
    .andWhere("event.slug = :slug", { slug })
    // FILTRO 3: Solo eventos públicos
    .andWhere("event.isPrivate = :isPrivate", { isPrivate: false })
    // SELECCIÓN: Campos necesarios del evento
    .select([
      "event.id",
      "event.title",
      "event.description",
      "event.slug",
      "event.duration",
      "event.locationType",
    ])
    // SELECCIÓN: Campos públicos del usuario
    .addSelect(["user.id", "user.name", "user.imageUrl"])
    .getOne(); // Un solo evento o null
  console.log("Public event retrieved:", username, slug, event);
  // RETORNO: Evento encontrado o null (manejado por controlador)
  return event;
};

/**
 * SERVICIO: Eliminar evento de manera segura
 * 
 * @param userId - ID del usuario propietario
 * @param eventId - ID del evento a eliminar
 * @returns Objeto con confirmación de éxito
 * 
 * SEGURIDAD:
 * - Solo el propietario puede eliminar sus eventos
 * - Validación estricta de propiedad
 * - Eliminación completa (no soft delete)
 */
export const deleteEventService = async (userId: string, eventId: string) => {
  const eventRepository = AppDataSource.getRepository(Event);
  const meetingRepository = AppDataSource.getRepository(Meeting);

  // BÚSQUEDA SEGURA: Evento debe existir Y pertenecer al usuario
  const event = await eventRepository.findOne({
    where: {
      id: eventId,           // Evento específico
      user: { id: userId }   // QUE PERTENEZCA al usuario (seguridad crítica)
    },
    relations: ["meetings"] // 🆕 INCLUIR: relaciones con reuniones
  });

  // VALIDACIÓN: Evento debe existir y ser del usuario correcto
  if (!event) {
    console.log("Event not found:", eventId);
    throw new NotFoundException("Event not found");
  }

  // 🆕 PASO 1: MANEJAR REUNIONES ASOCIADAS
  if (event.meetings && event.meetings.length > 0) {
    console.log(`Found ${event.meetings.length} meetings for event ${eventId}, cancelling them...`);

    // Cancelar cada reunión individualmente
    for (const meeting of event.meetings) {
      try {
        // Solo cancelar reuniones que estén programadas
        if (meeting.status === MeetingStatus.SCHEDULED) {
          await cancelMeetingService(meeting.id);
          console.log(`Meeting ${meeting.id} cancelled successfully`);
        }
      } catch (error) {
        // Log error pero continuar con otras reuniones
        if (error instanceof Error) {
          console.warn(`Failed to cancel meeting ${meeting.id}:`, error.message);
        } else {
          console.warn(`Failed to cancel meeting ${meeting.id}:`, error);
        }

        // Como fallback, marcar como cancelada en BD
        meeting.status = MeetingStatus.CANCELLED;
        await meetingRepository.save(meeting);
      }
    }

    // 🆕 PASO 2: ELIMINAR REUNIONES DE LA BASE DE DATOS
    // Eliminar físicamente todas las reuniones (ya canceladas)
    await meetingRepository.remove(event.meetings);
    console.log(`All meetings for event ${eventId} have been removed`);
  }

  // 🆕 PASO 3: ELIMINAR EL EVENTO
  // Ahora que no hay reuniones asociadas, eliminar el evento
  await eventRepository.remove(event);
  console.log("Event deleted:", eventId, "by user:", userId);

  // CONFIRMACIÓN: Respuesta de éxito
  return {
    success: true,
    message: "Event and associated meetings deleted successfully"
  };
};
