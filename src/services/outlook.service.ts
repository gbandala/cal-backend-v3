import { BadRequestException } from "../utils/app-error";

/**
 * SERVICIO DE OUTLOOK/MICROSOFT GRAPH
 * 
 * Proporciona funcionalidades para:
 * - Autenticación OAuth con Microsoft Graph
 * - Gestión de calendarios de Outlook
 * - Creación de eventos en calendarios de Outlook
 * - Validación y renovación de tokens
 */

interface OutlookCalendar {
  id: string;
  name: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
}

interface OutlookEventData {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  attendeeEmail: string;
  organizerEmail: string;
  zoomJoinUrl?: string; // Para eventos de Outlook + Zoom
}

interface OutlookEvent {
  id: string;
  webLink: string;
}




/**
 * VERSIÓN CORREGIDA: getOutlookCalendars
 * 
 * Maneja mejor los errores de permisos y calendar groups
 */
export const getOutlookCalendars = async (accessToken: string): Promise<OutlookCalendar[]> => {
  console.log('🔄 [FIXED] Getting Outlook calendars with enhanced permissions...');

  const foundCalendars = new Map<string, OutlookCalendar>();

  try {
    // ENFOQUE 1: Endpoint estándar con mejor manejo de errores
    const standardSuccess = await tryStandardCalendarsEndpoint(accessToken, foundCalendars);

    // ENFOQUE 2: Calendar Groups (mejorado para manejar permisos)
    if (!standardSuccess) {
      await tryEnhancedCalendarGroupsEndpoint(accessToken, foundCalendars);
    }

    // ENFOQUE 3: Fallback específico para errores de permisos
    if (foundCalendars.size === 0) {
      await createPermissionFallbackCalendar(foundCalendars);
    }

    const calendarsArray = Array.from(foundCalendars.values());

    console.log('✅ [FIXED] Total calendars found:', calendarsArray.length);
    calendarsArray.forEach(cal => {
      console.log(`   📅 ${cal.name} (${cal.id}) - Primary: ${cal.isDefaultCalendar}`);
    });

    return calendarsArray;

  } catch (error) {
    console.error('❌ [FIXED] Error getting calendars:', error);

    // ÚLTIMO RECURSO con información de debugging
    return [{
      id: 'primary',
      name: 'Calendar (Limited Permissions)',
      isDefaultCalendar: true,
      canEdit: true
    }];
  }
};

/**
 * ENFOQUE 1 MEJORADO: Standard endpoint con mejor logging
 */
async function tryStandardCalendarsEndpoint(
  accessToken: string,
  foundCalendars: Map<string, OutlookCalendar>
): Promise<boolean> {
  try {
    console.log('🔍 [APPROACH 1] Trying standard /me/calendars...');

    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();

      data.value?.forEach((calendar: any) => {
        const calendarData: OutlookCalendar = {
          id: calendar.id,
          name: calendar.name,
          isDefaultCalendar: calendar.isDefaultCalendar || false,
          canEdit: calendar.canEdit !== false
        };

        foundCalendars.set(calendar.id, calendarData);
        console.log(`   ✅ Found: ${calendar.name}`);
      });

      console.log(`🎯 [APPROACH 1] Standard endpoint found ${data.value?.length || 0} calendars`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`⚠️ [APPROACH 1] Standard endpoint failed: ${response.status} - ${errorText}`);

      // Específicamente buscar errores de permisos
      if (response.status === 403 || errorText.includes('insufficient')) {
        console.log('🔒 PERMISSIONS ERROR: Need to re-authorize with enhanced scopes');
      }
      return false;
    }
  } catch (error) {
    console.log(`❌ [APPROACH 1] Exception:`, error);
    return false;
  }
}

/**
 * ENFOQUE 2 MEJORADO: Calendar Groups con manejo de permisos
 */
async function tryEnhancedCalendarGroupsEndpoint(
  accessToken: string,
  foundCalendars: Map<string, OutlookCalendar>
): Promise<void> {
  try {
    console.log('🔍 [APPROACH 2] Trying enhanced calendar groups...');

    // Primero obtener los grupos
    const groupsResponse = await fetch('https://graph.microsoft.com/v1.0/me/calendarGroups', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (groupsResponse.ok) {
      const groupsData = await groupsResponse.json();
      console.log(`📁 Found ${groupsData.value?.length || 0} calendar groups`);

      // Para cada grupo, intentar diferentes endpoints
      for (const group of groupsData.value || []) {
        console.log(`🔍 Investigating group: "${group.name}" (${group.id})`);

        // MÉTODO A: Endpoint específico del grupo
        await tryGroupSpecificEndpoint(accessToken, group, foundCalendars);

        // MÉTODO B: Si el grupo es "Mis calendarios", intentar endpoints alternativos
        if (group.name === 'Mis calendarios' || group.name === 'My Calendars') {
          await tryMyCalendarsAlternatives(accessToken, foundCalendars);
        }
      }
    } else {
      console.log(`⚠️ [APPROACH 2] Calendar groups failed: ${groupsResponse.status}`);
    }
  } catch (error) {
    console.log(`❌ [APPROACH 2] Exception:`, error);
  }
}

/**
 * Intentar endpoint específico del grupo
 */
async function tryGroupSpecificEndpoint(
  accessToken: string,
  group: any,
  foundCalendars: Map<string, OutlookCalendar>
): Promise<void> {
  try {
    const groupCalendarsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarGroups/${group.id}/calendars`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (groupCalendarsResponse.ok) {
      const groupCalendarsData = await groupCalendarsResponse.json();

      if (groupCalendarsData.value && groupCalendarsData.value.length > 0) {
        groupCalendarsData.value.forEach((calendar: any) => {
          if (!foundCalendars.has(calendar.id)) {
            const calendarData: OutlookCalendar = {
              id: calendar.id,
              name: calendar.name,
              isDefaultCalendar: calendar.isDefaultCalendar || false,
              canEdit: calendar.canEdit !== false
            };

            foundCalendars.set(calendar.id, calendarData);
            console.log(`   ✅ Found in "${group.name}": ${calendar.name}`);
          }
        });
      } else {
        console.log(`   📭 Group "${group.name}" appears empty or no access`);
      }
    } else {
      const errorText = await groupCalendarsResponse.text();
      console.log(`   ❌ Cannot access group "${group.name}": ${groupCalendarsResponse.status} - ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ Exception accessing group "${group.name}":`, error);
  }
}

/**
 * Endpoints alternativos para "Mis calendarios" donde debería estar "consultorías"
 */
async function tryMyCalendarsAlternatives(
  accessToken: string,
  foundCalendars: Map<string, OutlookCalendar>
): Promise<void> {
  console.log('🔍 Trying alternatives for "Mis calendarios"...');

  // Alternativa 1: Buscar calendarios por eventos recientes
  try {
    const eventsResponse = await fetch(
      'https://graph.microsoft.com/v1.0/me/events?$select=calendar&$top=50&$filter=start/dateTime ge \'' +
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() + '\'', // Últimos 30 días
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (eventsResponse.ok) {
      const eventsData = await eventsResponse.json();
      const calendarNames = new Set<string>();

      eventsData.value?.forEach((event: any) => {
        if (event.calendar && event.calendar.name) {
          calendarNames.add(event.calendar.name);

          // Si encontramos "consultorías" en eventos, crear entrada
          if (event.calendar.name.toLowerCase().includes('consultor')) {
            const calendarData: OutlookCalendar = {
              id: event.calendar.id || `consultorias-${Date.now()}`,
              name: event.calendar.name,
              isDefaultCalendar: false,
              canEdit: true
            };

            foundCalendars.set(calendarData.id, calendarData);
            console.log(`   🎯 FOUND "consultorías" via events: ${event.calendar.name}`);
          }
        }
      });

      console.log(`   📅 Calendar names found in recent events:`, Array.from(calendarNames));
    }
  } catch (error) {
    console.log('   ❌ Events alternative failed:', error);
  }
}

/**
 * Fallback específico para errores de permisos
 */
async function createPermissionFallbackCalendar(foundCalendars: Map<string, OutlookCalendar>): Promise<void> {
  console.log('🔒 [APPROACH 4] Creating permission-aware fallback calendar...');

  const fallbackCalendar: OutlookCalendar = {
    id: 'primary',
    name: 'Calendar (Re-authorize needed)',
    isDefaultCalendar: true,
    canEdit: true
  };

  foundCalendars.set('primary', fallbackCalendar);
  console.log('   ⚠️ Fallback calendar created - user needs to re-authorize');
}



/**
 * Crea un evento en el calendario de Outlook especificado
 * @param accessToken - Token de acceso válido de Microsoft
 * @param calendarId - ID del calendario donde crear el evento
 * @param eventData - Datos del evento a crear
 * @returns Información del evento creado
 */
// export const createOutlookEvent = async (
//   accessToken: string, 
//   calendarId: string, 
//   eventData: OutlookEventData
// ): Promise<OutlookEvent> => {
//   try {
//     // Formatear descripción con link de Zoom si está presente
//     let description = eventData.description || '';
//     if (eventData.zoomJoinUrl) {
//       description += `\n\nUnirse a la reunión Zoom: ${eventData.zoomJoinUrl}`;
//     }

//     const requestBody = {
//       subject: eventData.title,
//       body: {
//         contentType: 'Text',
//         content: description
//       },
//       start: {
//         dateTime: eventData.startTime.toISOString(),
//         timeZone: eventData.timezone
//       },
//       end: {
//         dateTime: eventData.endTime.toISOString(), 
//         timeZone: eventData.timezone
//       },
//       attendees: [
//         {
//           emailAddress: {
//             address: eventData.attendeeEmail,
//             name: eventData.attendeeEmail.split('@')[0] // Nombre básico del email
//           },
//           type: 'required'
//         }
//       ],
//       // No incluimos onlineMeeting para Outlook + Zoom ya que usamos Zoom externamente
//       isOnlineMeeting: false
//     };

//     console.log('Creating Outlook event with data:', {
//       calendarId,
//       subject: requestBody.subject,
//       attendees: requestBody.attendees.length
//     });

//     const response = await fetch(`https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`, {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${accessToken}`,
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify(requestBody)
//     });

//     if (!response.ok) {
//       const error = await response.json();
//       console.error('Outlook event creation failed:', error);
//       throw new BadRequestException(`Failed to create Outlook event: ${error.error?.message || 'Unknown error'}`);
//     }

//     const event = await response.json();

//     console.log('Outlook event created successfully:', {
//       id: event.id,
//       subject: event.subject
//     });

//     return {
//       id: event.id,
//       webLink: event.webLink
//     };

//   } catch (error) {
//     console.error('Error creating Outlook event:', error);
//     throw error instanceof BadRequestException ? error : new BadRequestException('Failed to create Outlook event');
//   }
// };
export const createOutlookEvent = async (
  accessToken: string,
  calendarId: string,
  eventData: OutlookEventData
): Promise<OutlookEvent> => {
  try {
    let description = eventData.description || '';
    if (eventData.zoomJoinUrl) {
      description += `\n\nJoin Zoom Meeting: ${eventData.zoomJoinUrl}`;
    }

    const requestBody = {
      subject: eventData.title,
      body: {
        contentType: 'Text',
        content: description
      },
      start: {
        dateTime: eventData.startTime.toISOString(),
        timeZone: eventData.timezone
      },
      end: {
        dateTime: eventData.endTime.toISOString(),
        timeZone: eventData.timezone
      },
      attendees: [
        {
          emailAddress: {
            address: eventData.attendeeEmail,
            name: eventData.attendeeEmail.split('@')[0]
          },
          type: 'required'
        }
      ],
      isOnlineMeeting: false
    };

    // Para cuentas personales, usar endpoint directo de eventos
    let createUrl = 'https://graph.microsoft.com/v1.0/me/events';

    // Solo usar calendarId específico si no es 'primary'
    if (calendarId && calendarId !== 'primary') {
      createUrl = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`;
    }

    console.log('Creating Outlook event:', {
      url: createUrl,
      subject: requestBody.subject,
      attendees: requestBody.attendees.length
    });

    const response = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Outlook event creation failed:', error);
      throw new BadRequestException(`Failed to create Outlook event: ${error.error?.message || 'Unknown error'}`);
    }

    const event = await response.json();

    console.log('✅ Outlook event created:', {
      id: event.id,
      subject: event.subject
    });

    return {
      id: event.id,
      webLink: event.webLink
    };

  } catch (error) {
    console.error('Error creating Outlook event:', error);
    throw error instanceof BadRequestException ? error : new BadRequestException('Failed to create Outlook event');
  }
};
/**
 * Función helper para detectar tipo de cuenta
 */
export const detectAccountType = (userInfo: any): 'personal' | 'work' | 'unknown' => {
  const email = userInfo.mail || userInfo.userPrincipalName || '';

  // Dominios de cuentas personales
  const personalDomains = ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'];

  if (personalDomains.some(domain => email.toLowerCase().includes(domain))) {
    return 'personal';
  }

  // Si tiene userType definido, probablemente es cuenta empresarial
  if (userInfo.userType) {
    return 'work';
  }

  return 'unknown';
};

/**
 * Elimina un evento del calendario de Outlook
 * @param accessToken - Token de acceso válido de Microsoft
 * @param eventId - ID del evento a eliminar
 */
export const deleteOutlookEvent = async (accessToken: string, eventId: string): Promise<void> => {
  try {
    console.log('Deleting Outlook event:', eventId);

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Outlook event deletion failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });

      // Si el evento no existe (404), considerarlo como éxito
      if (response.status === 404) {
        console.log('Outlook event not found (may have been deleted already)');
        return;
      }

      throw new BadRequestException(`Failed to delete Outlook event: ${response.statusText}`);
    }

    console.log('Outlook event deleted successfully');

  } catch (error) {
    console.error('Error deleting Outlook event:', error);
    throw error instanceof BadRequestException ? error : new BadRequestException('Failed to delete Outlook event');
  }
};

/**
 * Valida y renueva token de Microsoft si es necesario
 * @param accessToken - Token actual de acceso
 * @param refreshToken - Token de renovación
 * @param expiryDate - Fecha de expiración del token (timestamp)
 * @returns Token válido (actual o renovado)
 */
export const validateMicrosoftToken = async (
  accessToken: string,
  refreshToken: string,
  expiryDate: number | null
): Promise<string> => {
  // Verificar si el token está expirado (con 5 minutos de margen)
  const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);

  if (expiryDate === null || fiveMinutesFromNow >= expiryDate) {
    console.log('Microsoft token expired, refreshing...');

    try {
      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: process.env.MICROSOFT_SCOPE!
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new BadRequestException(`Failed to refresh Microsoft token: ${error.error_description || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('Microsoft token refreshed successfully');

      return data.access_token;

    } catch (error) {
      console.error('Error refreshing Microsoft token:', error);
      throw new BadRequestException('Failed to refresh Microsoft token');
    }
  }

  // Token aún válido
  return accessToken;
};

/**
 * Obtiene información del usuario desde Microsoft Graph
 * @param accessToken - Token de acceso válido
 * @returns Información básica del usuario
 */
export const getMicrosoftUserInfo = async (accessToken: string) => {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new BadRequestException(`Failed to fetch user info: ${error.error?.message || 'Unknown error'}`);
    }

    const userInfo = await response.json();

    return {
      id: userInfo.id,
      email: userInfo.mail || userInfo.userPrincipalName,
      displayName: userInfo.displayName,
      givenName: userInfo.givenName,
      surname: userInfo.surname
    };

  } catch (error) {
    console.error('Error fetching Microsoft user info:', error);
    throw new BadRequestException('Failed to fetch user info');
  }
};