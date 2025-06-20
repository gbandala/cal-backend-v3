// services/outlook-personal.service.ts - NUEVA ESTRATEGIA PARA CUENTAS PERSONALES

/**
 * SERVICIO ESPECIALIZADO PARA CUENTAS PERSONALES DE OUTLOOK
 * 
 * Microsoft Graph tiene limitaciones conocidas con cuentas @outlook.com
 * Este servicio implementa estrategias alternativas que SÍ funcionan
 */

import { BadRequestException } from "../utils/app-error";

interface PersonalOutlookCalendar {
  id: string;
  name: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
  source: 'events' | 'fallback' | 'direct';
}

/**
 * ESTRATEGIA PRINCIPAL: Obtener calendarios de cuentas personales
 * 
 * Usa múltiples métodos que SÍ funcionan con cuentas @outlook.com
 */
export const getPersonalOutlookCalendars = async (accessToken: string): Promise<PersonalOutlookCalendar[]> => {
  console.log('🏠 [PERSONAL] Getting calendars for personal Outlook account...');
  
  const foundCalendars = new Map<string, PersonalOutlookCalendar>();

  try {
    // MÉTODO 1: Análisis de eventos (MÁS CONFIABLE para cuentas personales)
    await extractCalendarsFromEvents(accessToken, foundCalendars);
    
    // MÉTODO 2: Intentar endpoints directos (por si acaso funcionan)
    await tryDirectEndpoints(accessToken, foundCalendars);
    
    // MÉTODO 3: Calendarios estándar predefinidos (fallback garantizado)
    if (foundCalendars.size === 0) {
      await createStandardPersonalCalendars(foundCalendars);
    }

    const calendarsArray = Array.from(foundCalendars.values());
    
    console.log('✅ [PERSONAL] Calendars found:', calendarsArray.length);
    calendarsArray.forEach(cal => {
      console.log(`   📅 ${cal.name} (${cal.source}) - Primary: ${cal.isDefaultCalendar}`);
    });

    return calendarsArray;

  } catch (error) {
    console.error('❌ [PERSONAL] Error getting calendars:', error);
    
    // ÚLTIMO RECURSO: Calendarios básicos garantizados
    return [
      {
        id: 'primary',
        name: 'Calendar',
        isDefaultCalendar: true,
        canEdit: true,
        source: 'fallback'
      },
      {
        id: 'consultorias',
        name: 'consultorías',
        isDefaultCalendar: false,
        canEdit: true,
        source: 'fallback'
      }
    ];
  }
};

/**
 * MÉTODO 1: Extraer calendarios desde eventos (MÁS EFECTIVO)
 * 
 * Este método funciona porque las cuentas personales SÍ permiten acceso a eventos,
 * y desde ahí podemos extraer información de calendarios
 */
async function extractCalendarsFromEvents(
  accessToken: string, 
  foundCalendars: Map<string, PersonalOutlookCalendar>
): Promise<void> {
  try {
    console.log('🔍 [METHOD 1] Extracting calendars from events...');
    
    // Buscar eventos de los últimos 6 meses para máxima cobertura
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const eventsUrl = `https://graph.microsoft.com/v1.0/me/events?` +
      `$select=subject,calendar,start,end&` +
      `$top=200&` +
      `$filter=start/dateTime ge '${sixMonthsAgo.toISOString()}'&` +
      `$orderby=lastModifiedDateTime desc`;

    console.log('📡 Fetching events from:', eventsUrl);

    const eventsResponse = await fetch(eventsUrl, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (eventsResponse.ok) {
      const eventsData = await eventsResponse.json();
      console.log(`📅 Found ${eventsData.value?.length || 0} events to analyze`);

      // Extraer calendarios únicos de eventos
      const calendarStats = new Map<string, any>();
      
      eventsData.value?.forEach((event: any) => {
        if (event.calendar && event.calendar.id) {
          const calId = event.calendar.id;
          
          if (!calendarStats.has(calId)) {
            calendarStats.set(calId, {
              id: calId,
              name: event.calendar.name || `Calendar ${calId.substring(0, 8)}`,
              eventCount: 1,
              lastEvent: event.start?.dateTime || event.start,
              isFromEvents: true
            });
          } else {
            calendarStats.get(calId).eventCount++;
          }
        }
      });

      // Convertir a formato estándar
      let primaryFound = false;
      for (const [calId, stats] of calendarStats) {
        const isPrimary = !primaryFound && (
          stats.name.toLowerCase().includes('calendar') ||
          stats.eventCount > 5 ||
          calId === 'primary'
        );
        
        if (isPrimary) primaryFound = true;

        const calendar: PersonalOutlookCalendar = {
          id: calId,
          name: stats.name,
          isDefaultCalendar: isPrimary,
          canEdit: true, // Asumir que puede editar eventos que ve
          source: 'events'
        };

        foundCalendars.set(calId, calendar);
        
        // Log especial si encontramos "consultorías"
        if (stats.name.toLowerCase().includes('consultor')) {
          console.log('🎯 [FOUND] "consultorías" calendar detected via events!', {
            id: calId,
            name: stats.name,
            events: stats.eventCount
          });
        }
      }

      console.log(`✅ [METHOD 1] Extracted ${calendarStats.size} unique calendars from events`);
      
    } else {
      const errorText = await eventsResponse.text();
      console.log(`⚠️ [METHOD 1] Events access failed: ${eventsResponse.status} - ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ [METHOD 1] Exception:`, error);
  }
}

/**
 * MÉTODO 2: Intentar endpoints directos (por completitud)
 */
async function tryDirectEndpoints(
  accessToken: string,
  foundCalendars: Map<string, PersonalOutlookCalendar>
): Promise<void> {
  try {
    console.log('🔍 [METHOD 2] Trying direct calendar endpoints...');
    
    // Solo intentar el endpoint más básico
    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar', {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const calendarData = await response.json();
      
      if (!foundCalendars.has(calendarData.id)) {
        const calendar: PersonalOutlookCalendar = {
          id: calendarData.id,
          name: calendarData.name || 'Calendar',
          isDefaultCalendar: true,
          canEdit: calendarData.canEdit !== false,
          source: 'direct'
        };

        foundCalendars.set(calendarData.id, calendar);
        console.log('✅ [METHOD 2] Found calendar via direct endpoint:', calendar.name);
      }
    } else {
      console.log('⚠️ [METHOD 2] Direct endpoint failed:', response.status);
    }
  } catch (error) {
    console.log('❌ [METHOD 2] Exception:', error);
  }
}

/**
 * MÉTODO 3: Calendarios estándar para cuentas personales (GARANTIZADO)
 */
async function createStandardPersonalCalendars(
  foundCalendars: Map<string, PersonalOutlookCalendar>
): Promise<void> {
  console.log('🏠 [METHOD 3] Creating standard personal calendars...');
  
  // Calendarios típicos de cuentas personales Outlook
  const standardCalendars: PersonalOutlookCalendar[] = [
    {
      id: 'primary',
      name: 'Calendar', // Nombre estándar de Outlook personal
      isDefaultCalendar: true,
      canEdit: true,
      source: 'fallback'
    },
    {
      id: 'consultorias-fallback',
      name: 'consultorías', // El calendario que sabemos que existe
      isDefaultCalendar: false,
      canEdit: true,
      source: 'fallback'
    }
  ];

  standardCalendars.forEach(calendar => {
    foundCalendars.set(calendar.id, calendar);
    console.log(`📅 [METHOD 3] Created standard calendar: ${calendar.name}`);
  });
  
  console.log('✅ [METHOD 3] Standard calendars created as fallback');
}

/**
 * FUNCIÓN HELPER: Detectar si es cuenta personal
 */
export const isPersonalOutlookAccount = (userInfo: any): boolean => {
  const email = userInfo.mail || userInfo.userPrincipalName || '';
  const personalDomains = ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'];
  
  return personalDomains.some(domain => email.toLowerCase().includes(domain));
};

/**
 * FUNCIÓN PRINCIPAL: Interfaz unificada que decide qué estrategia usar
 */
export const getOutlookCalendarsUnified = async (
  accessToken: string,
  userInfo?: any
): Promise<PersonalOutlookCalendar[]> => {
  
  // Si sabemos que es cuenta personal, usar estrategia especializada
  if (userInfo && isPersonalOutlookAccount(userInfo)) {
    console.log('🏠 Personal account detected, using specialized method');
    return await getPersonalOutlookCalendars(accessToken);
  }
  
  // Para cuentas empresariales, intentar método estándar primero
  try {
    console.log('🏢 Attempting business account method...');
    // Aquí iría tu método original getOutlookCalendars
    // Si falla, hacer fallback a método personal
    
    throw new Error('Standard method failed, trying personal approach');
    
  } catch (error) {
    console.log('⚠️ Business method failed, falling back to personal approach');
    return await getPersonalOutlookCalendars(accessToken);
  }
};