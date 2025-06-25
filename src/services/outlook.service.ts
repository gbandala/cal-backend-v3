import { BadRequestException } from "../utils/app-error";

/**
 * SERVICIO DE OUTLOOK/MICROSOFT GRAPH CONSOLIDADO
 * 
 * Maneja tanto cuentas empresariales como personales
 * Incluye estrategias especializadas para @outlook.com/@hotmail.com
 */

interface OutlookCalendar {
  id: string;
  name: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
  source?: 'standard' | 'events' | 'fallback';
}

interface OutlookEventData {
  title: string;
  description?: string;
  startTime: Date | string;
  endTime: Date | string;
  timezone: string;
  attendeeEmail: string;
  organizerEmail: string;
  zoomJoinUrl?: string;
}

interface OutlookEvent {
  id: string;
  webLink: string;
}

/**
 * FUNCIÓN PRINCIPAL: Obtener calendarios de Outlook (empresariales y personales)
 */
export const getOutlookCalendars = async (accessToken: string): Promise<OutlookCalendar[]> => {
  console.log('📅 [OUTLOOK] Getting calendars with smart detection...');

  // 1. Detectar tipo de cuenta
  const userInfo = await getUserInfo(accessToken);
  const isPersonal = isPersonalOutlookAccount(userInfo);
  
  console.log('🔍 Account type detected:', isPersonal ? 'Personal' : 'Business');

  // 2. Usar estrategia apropiada
  if (isPersonal) {
    return await getPersonalOutlookCalendars(accessToken);
  } else {
    return await getBusinessOutlookCalendars(accessToken);
  }
};

/**
 * ESTRATEGIA PARA CUENTAS EMPRESARIALES
 */
async function getBusinessOutlookCalendars(accessToken: string): Promise<OutlookCalendar[]> {
  const foundCalendars = new Map<string, OutlookCalendar>();

  try {
    // Método estándar para cuentas empresariales
    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      data.value?.forEach((calendar: any) => {
        foundCalendars.set(calendar.id, {
          id: calendar.id,
          name: calendar.name,
          isDefaultCalendar: calendar.isDefaultCalendar || false,
          canEdit: calendar.canEdit !== false,
          source: 'standard'
        });
      });

      console.log('✅ Business calendars found:', foundCalendars.size);
    } else {
      console.log('⚠️ Standard method failed, trying fallback...');
      await createFallbackCalendar(foundCalendars);
    }

  } catch (error) {
    console.error('❌ Error with business calendars:', error);
    await createFallbackCalendar(foundCalendars);
  }

  return Array.from(foundCalendars.values());
}

/**
 * ESTRATEGIA PARA CUENTAS PERSONALES (@outlook.com, @hotmail.com, etc.)
 */
export async function getPersonalOutlookCalendars(accessToken: string): Promise<OutlookCalendar[]> {
  console.log('🏠 Using personal account strategy...');
  
  const foundCalendars = new Map<string, OutlookCalendar>();

  try {
    // MÉTODO 1: Extraer calendarios desde eventos (más confiable para cuentas personales)
    await extractCalendarsFromEvents(accessToken, foundCalendars);
    
    // MÉTODO 2: Intentar endpoint directo (por si funciona)
    if (foundCalendars.size === 0) {
      await tryDirectCalendarEndpoint(accessToken, foundCalendars);
    }
    
    // MÉTODO 3: Fallback garantizado
    if (foundCalendars.size === 0) {
      await createPersonalFallbackCalendars(foundCalendars);
    }

    console.log('✅ Personal calendars found:', foundCalendars.size);
    return Array.from(foundCalendars.values());

  } catch (error) {
    console.error('❌ Error with personal calendars:', error);
    
    // Último recurso para cuentas personales
    return [{
      id: 'primary',
      name: 'Calendar',
      isDefaultCalendar: true,
      canEdit: true,
      source: 'fallback'
    }];
  }
}

/**
 * Extrae calendarios desde eventos (funciona bien con cuentas personales)
 */
async function extractCalendarsFromEvents(
  accessToken: string, 
  foundCalendars: Map<string, OutlookCalendar>
): Promise<void> {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const eventsUrl = `https://graph.microsoft.com/v1.0/me/events?` +
      `$select=subject,calendar,start,end&` +
      `$top=200&` +
      `$filter=start/dateTime ge '${sixMonthsAgo.toISOString()}'&` +
      `$orderby=lastModifiedDateTime desc`;

    const eventsResponse = await fetch(eventsUrl, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (eventsResponse.ok) {
      const eventsData = await eventsResponse.json();
      const calendarStats = new Map<string, any>();
      
      eventsData.value?.forEach((event: any) => {
        if (event.calendar && event.calendar.id) {
          const calId = event.calendar.id;
          
          if (!calendarStats.has(calId)) {
            calendarStats.set(calId, {
              id: calId,
              name: event.calendar.name || `Calendar ${calId.substring(0, 8)}`,
              eventCount: 1
            });
          } else {
            calendarStats.get(calId).eventCount++;
          }
        }
      });

      // Convertir a OutlookCalendar
      let primaryFound = false;
      for (const [calId, stats] of calendarStats) {
        const isPrimary = !primaryFound && (
          stats.name.toLowerCase().includes('calendar') ||
          stats.eventCount > 5
        );
        
        if (isPrimary) primaryFound = true;

        foundCalendars.set(calId, {
          id: calId,
          name: stats.name,
          isDefaultCalendar: isPrimary,
          canEdit: true,
          source: 'events'
        });
      }

      console.log(`✅ Extracted ${calendarStats.size} calendars from events`);
    }
  } catch (error) {
    console.log('❌ Events extraction failed:', error);
  }
}

/**
 * Intenta endpoint directo de calendario
 */
async function tryDirectCalendarEndpoint(
  accessToken: string,
  foundCalendars: Map<string, OutlookCalendar>
): Promise<void> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar', {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const calendarData = await response.json();
      
      foundCalendars.set(calendarData.id, {
        id: calendarData.id,
        name: calendarData.name || 'Calendar',
        isDefaultCalendar: true,
        canEdit: calendarData.canEdit !== false,
        source: 'standard'
      });
      
      console.log('✅ Direct endpoint worked');
    }
  } catch (error) {
    console.log('❌ Direct endpoint failed:', error);
  }
}

/**
 * Crea calendarios fallback para cuentas personales
 */
async function createPersonalFallbackCalendars(
  foundCalendars: Map<string, OutlookCalendar>
): Promise<void> {
  const fallbackCalendars = [
    {
      id: 'primary',
      name: 'Calendar',
      isDefaultCalendar: true,
      canEdit: true,
      source: 'fallback' as const
    }
  ];

  fallbackCalendars.forEach(calendar => {
    foundCalendars.set(calendar.id, calendar);
  });
  
  console.log('✅ Personal fallback calendars created');
}

/**
 * Crea calendario fallback genérico
 */
async function createFallbackCalendar(foundCalendars: Map<string, OutlookCalendar>): Promise<void> {
  foundCalendars.set('primary', {
    id: 'primary',
    name: 'Calendar',
    isDefaultCalendar: true,
    canEdit: true,
    source: 'fallback'
  });
}

/**
 * Detecta si es cuenta personal de Outlook
 */
export const isPersonalOutlookAccount = (userInfo: any): boolean => {
  const email = userInfo?.mail || userInfo?.userPrincipalName || '';
  const personalDomains = ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'];
  
  return personalDomains.some(domain => email.toLowerCase().includes(domain));
};

/**
 * Obtiene información del usuario
 */
async function getUserInfo(accessToken: string): Promise<any> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log('⚠️ Could not get user info');
  }
  
  return {};
}

/**
 * Crea un evento en Outlook Calendar
 */
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

    const startTime = new Date(eventData.startTime).toISOString().slice(0, -1);
    const endTime = new Date(eventData.endTime).toISOString().slice(0, -1);

    const requestBody = {
      subject: eventData.title,
      body: {
        contentType: 'Text',
        content: description
      },
      start: {
        dateTime: startTime,
        timeZone: eventData.timezone
      },
      end: {
        dateTime: endTime,
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

    // Usar endpoint apropiado según calendar ID
    let createUrl = 'https://graph.microsoft.com/v1.0/me/events';
    if (calendarId && calendarId !== 'primary') {
      createUrl = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`;
    }

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
    console.error('❌ Error creating Outlook event:', error);
    throw error instanceof BadRequestException ? error : new BadRequestException('Failed to create Outlook event');
  }
};

/**
 * Elimina un evento de Outlook
 */
export const deleteOutlookEvent = async (accessToken: string, eventId: string): Promise<void> => {
  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok && response.status !== 404) {
      throw new BadRequestException(`Failed to delete Outlook event: ${response.statusText}`);
    }

    console.log('✅ Outlook event deleted');

  } catch (error) {
    console.error('❌ Error deleting Outlook event:', error);
    throw error instanceof BadRequestException ? error : new BadRequestException('Failed to delete Outlook event');
  }
};

/**
 * Valida y renueva token de Microsoft
 */
export const validateMicrosoftToken = async (
  accessToken: string,
  refreshToken: string,
  expiryDate: number | null
): Promise<string> => {
  const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);

  if (expiryDate === null || fiveMinutesFromNow >= expiryDate) {
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
      return data.access_token;

    } catch (error) {
      console.error('❌ Error refreshing Microsoft token:', error);
      throw new BadRequestException('Failed to refresh Microsoft token');
    }
  }

  return accessToken;
};

/**
 * Obtiene información del usuario de Microsoft
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
    console.error('❌ Error fetching Microsoft user info:', error);
    throw new BadRequestException('Failed to fetch user info');
  }
};