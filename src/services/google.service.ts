import { BadRequestException } from "../utils/app-error";
import { validateGoogleToken } from "./integration.service";
import { googleOAuth2Client } from "../config/oauth.config";
import { google } from "googleapis";
import { CalendarEvent, CalendarEventsQuery, CalendarEventsResult } from "../@types/calendar-event.type";

/**
 * SERVICIO DE GOOGLE CALENDAR
 * 
 * Proporciona funcionalidades para:
 * - Autenticación OAuth con Google Calendar
 * - Gestión de calendarios de Google
 * - Creación de eventos en calendarios de Google
 * - Validación y renovación de tokens
 * 
 * PATRÓN: Igual que outlook.service.ts pero para Google Calendar
 */

interface GoogleCalendar {
  id: string;
  name: string;
  isPrimary: boolean;
  canEdit: boolean;
}

interface GoogleEventData {
  title: string;
  description?: string;
  startTime: Date | string; // Puede ser Date o ISO string
  endTime: Date | string; // Puede ser Date o ISO string
  timezone: string;
  attendeeEmail: string;
  organizerEmail: string;
  zoomJoinUrl?: string; // Para eventos de Google Calendar + Zoom
}

interface GoogleEvent {
  id: string;
  webLink: string;
  hangoutLink?: string; // Para Google Meet integrado
}

/**
 * Obtiene la lista de calendarios de Google disponibles para el usuario
 * @param accessToken - Token de acceso válido de Google
 * @returns Array de calendarios disponibles
 */
export const getGoogleCalendars = async (accessToken: string): Promise<GoogleCalendar[]> => {
  console.log('📅 [GOOGLE_SERVICE] Getting Google calendars...');

  try {
    // Configurar cliente OAuth
    googleOAuth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({
      version: "v3",
      auth: googleOAuth2Client,
    });

    // Obtener lista de calendarios
    const response = await calendar.calendarList.list({
      minAccessRole: 'writer' // Solo calendarios donde puede escribir
    });

    const calendars: GoogleCalendar[] = [];

    if (response.data.items) {
      response.data.items.forEach((cal: any) => {
        const calendarData: GoogleCalendar = {
          id: cal.id,
          name: cal.summary || cal.id,
          isPrimary: cal.primary || false,
          canEdit: cal.accessRole === 'owner' || cal.accessRole === 'writer'
        };

        calendars.push(calendarData);
        console.log(`   📅 Found: ${cal.summary} (${cal.id}) - Primary: ${cal.primary}`);
      });
    }

    console.log('✅ [GOOGLE_SERVICE] Total calendars found:', calendars.length);
    return calendars;

  } catch (error) {
    console.error('❌ [GOOGLE_SERVICE] Error getting calendars:', error);

    // Fallback: retornar calendario primario
    return [{
      id: 'primary',
      name: 'Primary Calendar',
      isPrimary: true,
      canEdit: true
    }];
  }
};

/**
 * Crea un evento en el calendario de Google especificado
 * @param accessToken - Token de acceso válido de Google
 * @param calendarId - ID del calendario donde crear el evento
 * @param eventData - Datos del evento a crear
 * @returns Información del evento creado
 */
export const createGoogleCalendarEvent = async (
  accessToken: string,
  calendarId: string,
  eventData: GoogleEventData
): Promise<GoogleEvent> => {
  try {
    console.log('📅 [GOOGLE_SERVICE] Creating Google Calendar event:', {
      calendarId,
      title: eventData.title,
      attendeeEmail: eventData.attendeeEmail
    });

    // Configurar cliente OAuth
    googleOAuth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({
      version: "v3",
      auth: googleOAuth2Client,
    });

    // Formatear fechas para Google Calendar API
    const formatDateForCalendar = (date: Date | string): string => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toISOString().replace('Z', '');
    };

    const formattedStart = formatDateForCalendar(eventData.startTime);
    const formattedEnd = formatDateForCalendar(eventData.endTime);

    // Construir descripción del evento
    let description = eventData.description || '';
    if (eventData.zoomJoinUrl) {
      description += `\n\nJoin Meeting: ${eventData.zoomJoinUrl}`;
    }

    // Preparar datos del evento
    const requestBody: any = {
      summary: eventData.title,
      description: description,
      start: {
        dateTime: formattedStart,
        timeZone: eventData.timezone,
      },
      end: {
        dateTime: formattedEnd,
        timeZone: eventData.timezone,
      },
      attendees: [
        { email: eventData.attendeeEmail },
        { email: eventData.organizerEmail }
      ],
    };

    // Si NO hay zoomJoinUrl, incluir Google Meet automáticamente
    if (!eventData.zoomJoinUrl) {
      requestBody.conferenceData = {
        createRequest: {
          requestId: `${Date.now()}-${Math.random()}`,
        },
      };
    }

    console.log('📅 [GOOGLE_SERVICE] Request body prepared:', {
      summary: requestBody.summary,
      attendees: requestBody.attendees.length,
      hasConferenceData: !!requestBody.conferenceData,
      hasZoomUrl: !!eventData.zoomJoinUrl
    });

    // Crear evento
    const response = await calendar.events.insert({
      calendarId: calendarId,
      conferenceDataVersion: requestBody.conferenceData ? 1 : 0,
      requestBody,
    });

    const event = response.data;

    console.log('✅ [GOOGLE_SERVICE] Event created successfully:', {
      id: event.id,
      summary: event.summary,
      hangoutLink: event.hangoutLink ? '✅' : '❌'
    });

    return {
      id: event.id!,
      webLink: event.htmlLink!,
      hangoutLink: event.hangoutLink || undefined
    };

  } catch (error) {
    console.error('❌ [GOOGLE_SERVICE] Error creating event:', error);
    throw new BadRequestException(
      `Failed to create Google Calendar event: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Elimina un evento del calendario de Google
 * @param accessToken - Token de acceso válido de Google
 * @param calendarId - ID del calendario
 * @param eventId - ID del evento a eliminar
 */
export const deleteGoogleCalendarEvent = async (
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> => {
  try {
    console.log('🗑️ [GOOGLE_SERVICE] Deleting Google Calendar event:', {
      calendarId,
      eventId
    });

    // Configurar cliente OAuth
    googleOAuth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({
      version: "v3",
      auth: googleOAuth2Client,
    });

    // Eliminar evento
    await calendar.events.delete({
      calendarId: calendarId,
      eventId: eventId,
    });

    console.log('✅ [GOOGLE_SERVICE] Event deleted successfully');

  } catch (error) {
    console.error('❌ [GOOGLE_SERVICE] Error deleting event:', error);

    // Si el evento no existe (404), considerarlo como éxito
    if (error instanceof Error && error.message.includes('404')) {
      console.log('ℹ️ [GOOGLE_SERVICE] Event not found (may have been deleted already)');
      return;
    }

    throw new BadRequestException(
      `Failed to delete Google Calendar event: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Valida y renueva token de Google si es necesario
 * @param accessToken - Token actual de acceso
 * @param refreshToken - Token de renovación
 * @param expiryDate - Fecha de expiración del token (timestamp)
 * @returns Token válido (actual o renovado)
 */
export const validateGoogleCalendarToken = async (
  accessToken: string,
  refreshToken: string,
  expiryDate: number | null
): Promise<string> => {
  try {
    // Usar la función existente de integration.service
    const validToken = await validateGoogleToken(accessToken, refreshToken, expiryDate);
    return validToken ?? "";
  } catch (error) {
    console.error('❌ [GOOGLE_SERVICE] Token validation failed:', error);
    throw new BadRequestException(
      `Google token validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Obtiene información del usuario desde Google API
 * @param accessToken - Token de acceso válido
 * @returns Información básica del usuario
 */
export const getGoogleUserInfo = async (accessToken: string) => {
  try {
    console.log('👤 [GOOGLE_SERVICE] Getting Google user info...');

    // Configurar cliente OAuth
    googleOAuth2Client.setCredentials({ access_token: accessToken });

    const oauth2 = google.oauth2({
      version: 'v2',
      auth: googleOAuth2Client,
    });

    const response = await oauth2.userinfo.get();
    const userInfo = response.data;

    console.log('✅ [GOOGLE_SERVICE] User info retrieved:', {
      id: userInfo.id,
      email: userInfo.email
    });

    return {
      id: userInfo.id,
      email: userInfo.email,
      displayName: userInfo.name,
      givenName: userInfo.given_name,
      familyName: userInfo.family_name,
      picture: userInfo.picture
    };

  } catch (error) {
    console.error('❌ [GOOGLE_SERVICE] Error fetching user info:', error);
    throw new BadRequestException('Failed to fetch Google user info');
  }
};

/**
 * Obtiene cliente configurado de Google Calendar
 * @param accessToken - Token de acceso válido
 * @returns Cliente de Google Calendar configurado
 */
export const getGoogleCalendarClient = async (accessToken: string) => {
  try {
    // Validar token primero usando la función existente
    const validToken = await validateGoogleToken(accessToken, '', null);

    // Configurar cliente OAuth
    googleOAuth2Client.setCredentials({ access_token: validToken });

    const calendar = google.calendar({
      version: "v3",
      auth: googleOAuth2Client,
    });

    return {
      calendar,
      accessToken: validToken
    };

  } catch (error) {
    console.error('❌ [GOOGLE_SERVICE] Error creating calendar client:', error);
    throw new BadRequestException('Failed to initialize Google Calendar client');
  }
};

/**
 * Función helper para detectar tipo de calendario
 */
export const detectGoogleCalendarType = (calendar: any): 'primary' | 'personal' | 'work' => {
  if (calendar.primary) {
    return 'primary';
  }

  const summary = calendar.summary?.toLowerCase() || '';

  // Detectar calendarios de trabajo
  if (summary.includes('work') || summary.includes('office') || summary.includes('company')) {
    return 'work';
  }

  return 'personal';
};

/**
 * Función para normalizar calendar ID de Google
 */
export const normalizeGoogleCalendarId = (calendarId: string): string => {
  // Google Calendar acepta:
  // - 'primary' para calendario principal
  // - Emails como calendar IDs
  // - IDs específicos de calendarios

  if (!calendarId || calendarId === 'primary') {
    return 'primary';
  }

  // Si parece un email, mantenerlo
  if (calendarId.includes('@')) {
    return calendarId;
  }

  // Si es muy corto o genérico, usar primary
  if (calendarId.length < 10 || 
      calendarId.includes('fallback') || 
      calendarId === 'consultorias') {
    return 'primary';
  }

  return calendarId;
};

/**
 * NUEVA FUNCIÓN: Obtiene eventos de un calendario de Google para una fecha específica
 * 
 * @param accessToken - Token de acceso válido de Google
 * @param calendarId - ID del calendario ('primary' o ID específico)
 * @param date - Fecha en formato YYYY-MM-DD
 * @param timezone - Zona horaria para la consulta (ej: 'America/Mexico_City')
 * @returns Array de eventos del calendario
 */
export const getGoogleCalendarEvents = async (
  accessToken: string,
  calendarId: string,
  date: string,
  timezone: string = 'UTC'
): Promise<CalendarEvent[]> => {
  console.log('📅 [GOOGLE_SERVICE] Getting calendar events:', {
    calendarId,
    date,
    timezone
  });

  try {
    // Configurar cliente OAuth
    googleOAuth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({
      version: "v3",
      auth: googleOAuth2Client,
    });

    // Calcular timeMin y timeMax para el día específico en la zona horaria dada
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    
    // Convertir a UTC para la API de Google Calendar
    const timeMin = dayStart.toISOString();
    const timeMax = dayEnd.toISOString();

    console.log('🔍 [GOOGLE_SERVICE] Query parameters:', {
      calendarId,
      timeMin,
      timeMax,
      timezone
    });

    // Obtener eventos del calendario
    const response = await calendar.events.list({
      calendarId: normalizeGoogleCalendarId(calendarId),
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true, // Expandir eventos recurrentes
      orderBy: 'startTime',
      maxResults: 250, // Límite razonable para un día
      timeZone: timezone, // Zona horaria de referencia
    });

    if (!response.data.items) {
      console.log('📅 [GOOGLE_SERVICE] No events found for date:', date);
      return [];
    }

    // Convertir eventos de Google a formato estándar
    const events: CalendarEvent[] = response.data.items
      .filter(item => {
        // Filtrar eventos válidos
        return item.status !== 'cancelled' && 
               (item.start?.dateTime || item.start?.date) &&
               (item.end?.dateTime || item.end?.date);
      })
      .map(item => {
        const isAllDay = !item.start?.dateTime; // Si no tiene hora específica, es todo el día
        
        // Manejo de fechas: dateTime para eventos con hora, date para eventos de todo el día
        const startTime = isAllDay 
          ? new Date(`${item.start?.date}T00:00:00.000Z`)
          : new Date(item.start?.dateTime!);
          
        const endTime = isAllDay 
          ? new Date(`${item.end?.date}T23:59:59.999Z`)
          : new Date(item.end?.dateTime!);

        const event: CalendarEvent = {
          id: item.id!,
          title: item.summary || 'Evento sin título',
          startTime,
          endTime,
          isAllDay,
          status: item.status === 'confirmed' ? 'confirmed' : 
                  item.status === 'cancelled' ? 'cancelled' : 'tentative',
          organizer: item.organizer ? {
            email: item.organizer.email!,
            name: item.organizer.displayName || undefined
          } : undefined,
          attendees: item.attendees?.map(attendee => ({
            email: attendee.email!,
            name: attendee.displayName || undefined,
            responseStatus: attendee.responseStatus as any
          })),
          description: item.description || undefined,
          location: item.location || undefined,
          isRecurring: !!item.recurringEventId,
          timeZone: timezone,
          providerData: {
            provider: 'google',
            originalEvent: item
          }
        };

        return event;
      });

    console.log('✅ [GOOGLE_SERVICE] Events retrieved successfully:', {
      calendarId,
      date,
      eventsCount: events.length,
      allDayEvents: events.filter(e => e.isAllDay).length,
      timedEvents: events.filter(e => !e.isAllDay).length
    });
    console.log('---------------------------------------------------------------');
    // Log de eventos para debugging
    events.forEach(event => {
      console.log(`   📝 Event: "${event.title}" (${event.startTime.toISOString()} - ${event.endTime.toISOString()}) [AllDay: ${event.isAllDay}]`);
    });
     console.log('---------------------------------------------------------------');

    return events;

  } catch (error) {
    console.error('❌ [GOOGLE_SERVICE] Error getting calendar events:', {
      error: error instanceof Error ? error.message : String(error),
      calendarId,
      date,
      timezone
    });

    // Para eventos del calendario, es mejor fallar silenciosamente que interrumpir el flujo
    // El sistema puede continuar funcionando solo con meetings + availability
    console.warn('⚠️ [GOOGLE_SERVICE] Continuing without calendar events due to error');
    return [];
  }
};

/**
 * FUNCIÓN ALTERNATIVA: Obtiene eventos usando la nueva interfaz más robusta
 * 
 * @param accessToken - Token de acceso válido de Google
 * @param query - Parámetros de consulta estructurados
 * @returns Resultado detallado de la consulta
 */
export const getGoogleCalendarEventsAdvanced = async (
  accessToken: string,
  query: CalendarEventsQuery
): Promise<CalendarEventsResult> => {
  console.log('📅 [GOOGLE_SERVICE] Getting calendar events (advanced):', query);

  const result: CalendarEventsResult = {
    events: [],
    totalCount: 0,
    provider: 'google',
    calendarId: query.calendarId,
    date: query.date,
    hasErrors: false,
    errors: []
  };

  try {
    const events = await getGoogleCalendarEvents(
      accessToken,
      query.calendarId,
      query.date,
      query.timezone
    );

    // Aplicar filtros adicionales si se especifican
    let filteredEvents = events;

    if (!query.includeAllDay) {
      filteredEvents = filteredEvents.filter(event => !event.isAllDay);
    }

    if (!query.includeCancelled) {
      filteredEvents = filteredEvents.filter(event => event.status !== 'cancelled');
    }

    if (query.maxResults) {
      filteredEvents = filteredEvents.slice(0, query.maxResults);
    }

    result.events = filteredEvents;
    result.totalCount = events.length;

    console.log('✅ [GOOGLE_SERVICE] Advanced query completed:', {
      originalEvents: events.length,
      filteredEvents: filteredEvents.length,
      appliedFilters: {
        includeAllDay: query.includeAllDay,
        includeCancelled: query.includeCancelled,
        maxResults: query.maxResults
      }
    });

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    result.hasErrors = true;
    result.errors = [errorMessage];

    console.error('❌ [GOOGLE_SERVICE] Advanced query failed:', {
      error: errorMessage,
      query
    });

    return result;
  }
};

// FUNCIÓN HELPER NUEVA: Agregar esta función al final del archivo
/**
 * FUNCIÓN HELPER: Mapea estados de respuesta de Google Calendar a formato estándar
 * 
 * @param googleStatus - Estado de respuesta de Google Calendar
 * @returns Estado en formato estándar
 */
function mapGoogleResponseStatus(googleStatus?: string): 'accepted' | 'declined' | 'tentative' | 'needsAction' {
  switch (googleStatus) {
    case 'accepted':
      return 'accepted';
    case 'declined':
      return 'declined';
    case 'tentative':
      return 'tentative';
    case 'needsAction':
      return 'needsAction';
    default:
      return 'needsAction'; // Default para valores undefined o desconocidos
  }
}