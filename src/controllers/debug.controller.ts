// controllers/debug.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middeware";
import { HTTPSTATUS } from "../config/http.config";
import { getValidMicrosoftToken } from "../services/token.service";
import { getPersonalOutlookCalendars, isPersonalOutlookAccount } from "../services/outlook-personal.service";
import { AppDataSource } from "../config/database.config";
import {
  Integration,
  IntegrationAppTypeEnum,
  IntegrationCategoryEnum,
  IntegrationProviderEnum,
} from "../database/entities/integration.entity";
/**
 * 🚨 ENDPOINT TEMPORAL DE DEBUG
 * 
 * Para investigar por qué no aparece el calendario "consultorías"
 * Prueba múltiples endpoints de Microsoft Graph
 */
export const debugMicrosoftCalendarsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;

    console.log('🔍 DEBUG: Starting Microsoft calendars investigation for user:', userId);

    try {
      // 1. Obtener token válido
      const accessToken = await getValidMicrosoftToken(userId);
      
      const debugResults = {
        standardCalendars: null as any,
        calendarGroups: null as any,
        eventsCalendar: null as any,
        alternativeEndpoints: [] as any[],
        errors: [] as string[]
      };

      // 2. ENDPOINT ESTÁNDAR: /me/calendars
      try {
        console.log('🔄 Testing standard /me/calendars endpoint...');
        const standardResponse = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (standardResponse.ok) {
          const standardData = await standardResponse.json();
          debugResults.standardCalendars = {
            success: true,
            count: standardData.value?.length || 0,
            calendars: standardData.value?.map((cal: any) => ({
              id: cal.id,
              name: cal.name,
              isDefaultCalendar: cal.isDefaultCalendar,
              canEdit: cal.canEdit,
              color: cal.color,
              owner: cal.owner?.name
            })) || []
          };
          console.log('✅ Standard calendars found:', debugResults.standardCalendars.count);
        } else {
          const errorText = await standardResponse.text();
          debugResults.standardCalendars = {
            success: false,
            error: `${standardResponse.status}: ${errorText}`
          };
          debugResults.errors.push(`Standard calendars: ${standardResponse.status}`);
        }
      } catch (error) {
        debugResults.errors.push(`Standard calendars exception: ${error}`);
      }

      // 3. CALENDAR GROUPS: /me/calendarGroups
      try {
        console.log('🔄 Testing calendar groups endpoint...');
        const groupsResponse = await fetch('https://graph.microsoft.com/v1.0/me/calendarGroups', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (groupsResponse.ok) {
          const groupsData = await groupsResponse.json();
          debugResults.calendarGroups = {
            success: true,
            count: groupsData.value?.length || 0,
            groups: groupsData.value?.map((group: any) => ({
              id: group.id,
              name: group.name,
              classId: group.classId
            })) || []
          };

          // Para cada grupo, obtener sus calendarios
          for (const group of groupsData.value || []) {
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
                debugResults.alternativeEndpoints.push({
                  endpoint: `/calendarGroups/${group.id}/calendars`,
                  groupName: group.name,
                  calendars: groupCalendarsData.value?.map((cal: any) => ({
                    id: cal.id,
                    name: cal.name,
                    isDefaultCalendar: cal.isDefaultCalendar
                  })) || []
                });
              }
            } catch (groupError) {
              debugResults.errors.push(`Group ${group.name} calendars: ${groupError}`);
            }
          }

          console.log('✅ Calendar groups found:', debugResults.calendarGroups.count);
        } else {
          debugResults.calendarGroups = {
            success: false,
            error: `${groupsResponse.status}: ${await groupsResponse.text()}`
          };
        }
      } catch (error) {
        debugResults.errors.push(`Calendar groups exception: ${error}`);
      }

      // 4. EVENTS APPROACH: /me/events con calendarios únicos
      try {
        console.log('🔄 Testing events approach...');
        const eventsResponse = await fetch('https://graph.microsoft.com/v1.0/me/events?$select=calendar&$top=100', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          const uniqueCalendars = new Map();

          eventsData.value?.forEach((event: any) => {
            if (event.calendar && event.calendar.id) {
              uniqueCalendars.set(event.calendar.id, {
                id: event.calendar.id,
                name: event.calendar.name,
                source: 'events'
              });
            }
          });

          debugResults.eventsCalendar = {
            success: true,
            totalEvents: eventsData.value?.length || 0,
            uniqueCalendars: Array.from(uniqueCalendars.values())
          };

          console.log('✅ Events calendar analysis:', debugResults.eventsCalendar.uniqueCalendars.length, 'unique calendars');
        } else {
          debugResults.eventsCalendar = {
            success: false,
            error: `${eventsResponse.status}: ${await eventsResponse.text()}`
          };
        }
      } catch (error) {
        debugResults.errors.push(`Events approach exception: ${error}`);
      }

      // 5. RESULTADO FINAL
      console.log('📊 DEBUG Results Summary:');
      console.log('  Standard calendars:', debugResults.standardCalendars?.count || 'failed');
      console.log('  Calendar groups:', debugResults.calendarGroups?.count || 'failed');
      console.log('  Events calendars:', debugResults.eventsCalendar?.uniqueCalendars?.length || 'failed');
      console.log('  Errors:', debugResults.errors.length);

      return res.status(HTTPSTATUS.OK).json({
        message: "Microsoft calendars debug completed",
        userId,
        debugResults,
        recommendation: debugResults.errors.length > 0 
          ? "Hay errores de permisos - revisar scopes OAuth"
          : "Investigar endpoints alternativos para encontrar 'consultorías'",
        success: true
      });

    } catch (error) {
      console.error('❌ Error in debug calendars:', error);
      return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: "Debug failed",
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  }
);

/**
 * 🔬 ADVANCED DEBUG: Prueba diferentes estrategias para cuentas personales
 */
export const advancedOutlookDebugController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;

    console.log('🔬 ADVANCED DEBUG: Starting comprehensive Outlook investigation');

    try {
      const accessToken = await getValidMicrosoftToken(userId);
      
      const debugResults = {
        tokenValidation: null as any,
        userInfo: null as any,
        directCalendarTests: [] as any[],
        alternativeApproaches: [] as any[],
        accountTypeDetection: null as any,
        recommendations: [] as string[]
      };

      // 1. VALIDAR TOKEN Y PERMISOS
      console.log('🔄 Step 1: Token and permissions validation...');
      try {
        const meResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (meResponse.ok) {
          const userData = await meResponse.json();
          debugResults.userInfo = userData;
          
          // Detectar tipo de cuenta
          const accountType = userData.mail?.includes('outlook.com') || 
                             userData.mail?.includes('hotmail.com') || 
                             userData.mail?.includes('live.com') ? 'personal' : 'business';
          
          debugResults.accountTypeDetection = {
            email: userData.mail || userData.userPrincipalName,
            accountType,
            userType: userData.userType,
            tenantId: userData.id // Para cuentas personales es diferente
          };

          console.log('✅ Token valid, account type:', accountType);
        }

        debugResults.tokenValidation = {
          valid: meResponse.ok,
          status: meResponse.status
        };
      } catch (error) {
        debugResults.tokenValidation = { valid: false, error: String(error) };
      }

      // 2. PRUEBAS DIRECTAS DE CALENDARIOS
      console.log('🔄 Step 2: Direct calendar endpoint tests...');
      
      const calendarEndpoints = [
        'https://graph.microsoft.com/v1.0/me/calendars',
        'https://graph.microsoft.com/v1.0/me/calendar',
        'https://graph.microsoft.com/beta/me/calendars', // Beta API
        'https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar',
        'https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=2025-06-20T00:00:00Z&endDateTime=2025-06-21T00:00:00Z&$select=calendar'
      ];

      for (const endpoint of calendarEndpoints) {
        try {
          console.log(`🔍 Testing: ${endpoint}`);
          
          const response = await fetch(endpoint, {
            headers: { 
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          let result: any = {
            endpoint,
            status: response.status,
            success: response.ok
          };

          if (response.ok) {
            const data = await response.json();
            result.data = data;
            result.calendarsFound = data.value?.length || (data.id ? 1 : 0);
            
            if (data.value) {
              result.calendarNames = data.value.map((cal: any) => cal.name || cal.calendar?.name);
            }
          } else {
            const errorText = await response.text();
            result.error = errorText;
            
            // Log específico para errores 500
            if (response.status === 500) {
              console.log('❌ Error 500 details:', {
                endpoint,
                error: errorText
              });
            }
          }

          debugResults.directCalendarTests.push(result);
        } catch (error) {
          debugResults.directCalendarTests.push({
            endpoint,
            status: 'exception',
            error: String(error)
          });
        }
      }

      // 3. ENFOQUES ALTERNATIVOS PARA CUENTAS PERSONALES
      console.log('🔄 Step 3: Alternative approaches for personal accounts...');

      // 3A: Buscar eventos y extraer calendarios únicos
      try {
        console.log('🔍 Approach 3A: Extract calendars from recent events...');
        
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 2); // Últimos 2 meses
        
        const eventsResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/events?$select=subject,calendar,start&$top=100&$filter=start/dateTime ge '${startDate.toISOString()}'`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );

        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          const uniqueCalendars = new Map();
          
          eventsData.value?.forEach((event: any) => {
            if (event.calendar) {
              uniqueCalendars.set(event.calendar.id, {
                id: event.calendar.id,
                name: event.calendar.name,
                source: 'events'
              });
            }
          });

          debugResults.alternativeApproaches.push({
            method: 'events_extraction',
            success: true,
            totalEvents: eventsData.value?.length || 0,
            uniqueCalendars: Array.from(uniqueCalendars.values()),
            calendarsFound: uniqueCalendars.size
          });

          // VERIFICAR SI ENCONTRAMOS "consultorías"
          const consultoriasCalendar = Array.from(uniqueCalendars.values())
            .find((cal: any) => cal.name?.toLowerCase().includes('consultor'));
          
          if (consultoriasCalendar) {
            console.log('🎯 FOUND "consultorías" in events!', consultoriasCalendar);
            debugResults.recommendations.push('Found "consultorías" calendar via events analysis');
          }

        } else {
          debugResults.alternativeApproaches.push({
            method: 'events_extraction',
            success: false,
            error: await eventsResponse.text()
          });
        }
      } catch (error) {
        debugResults.alternativeApproaches.push({
          method: 'events_extraction',
          success: false,
          error: String(error)
        });
      }

      // 3B: Probar con OData query parameters diferentes
      try {
        console.log('🔍 Approach 3B: Alternative OData queries...');
        
        const odataQueries = [
          'https://graph.microsoft.com/v1.0/me/calendars?$orderby=name',
          'https://graph.microsoft.com/v1.0/me/calendars?$filter=canEdit eq true',
          'https://graph.microsoft.com/v1.0/me/calendars?$expand=owner'
        ];

        for (const query of odataQueries) {
          const response = await fetch(query, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          debugResults.alternativeApproaches.push({
            method: `odata_query`,
            query,
            success: response.ok,
            status: response.status,
            data: response.ok ? await response.json() : await response.text()
          });
        }
      } catch (error) {
        debugResults.alternativeApproaches.push({
          method: 'odata_queries',
          success: false,
          error: String(error)
        });
      }

      // 4. GENERAR RECOMENDACIONES
      if (debugResults.accountTypeDetection?.accountType === 'personal') {
        debugResults.recommendations.push('Personal account detected - Graph API limitations may apply');
      }

      const hasAnyCalendarAccess = debugResults.directCalendarTests.some(test => test.success);
      if (!hasAnyCalendarAccess) {
        debugResults.recommendations.push('No calendar endpoints working - possible Graph API service issue');
        debugResults.recommendations.push('Consider using Microsoft Graph Explorer for manual testing');
      }

      const eventsApproach = debugResults.alternativeApproaches.find(a => a.method === 'events_extraction');
      if (eventsApproach?.success && eventsApproach.calendarsFound > 0) {
        debugResults.recommendations.push('Events extraction method is viable - implement as fallback');
      }

      console.log('🎯 Advanced debug completed');

      return res.status(HTTPSTATUS.OK).json({
        message: "Advanced Outlook debug completed",
        userId,
        debugResults,
        summary: {
          tokenValid: debugResults.tokenValidation?.valid,
          accountType: debugResults.accountTypeDetection?.accountType,
          calendarEndpointsWorking: debugResults.directCalendarTests.filter(t => t.success).length,
          alternativeMethodsAvailable: debugResults.alternativeApproaches.filter(a => a.success).length,
          consultoriasFound: debugResults.recommendations.some(r => r.includes('consultorías'))
        },
        nextSteps: debugResults.recommendations,
        success: true
      });

    } catch (error) {
      console.error('❌ Error in advanced debug:', error);
      return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: "Advanced debug failed",
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  }
);

/**
 * 🧪 TEST ENDPOINT: Probar estrategia de cuentas personales
 */
export const testPersonalOutlookController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;

    console.log('🧪 [TEST] Testing personal Outlook strategy for user:', userId);

    try {
      const accessToken = await getValidMicrosoftToken(userId);
      
      // 1. Detectar tipo de cuenta
      const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const userInfo = userResponse.ok ? await userResponse.json() : null;
      const isPersonal = userInfo ? isPersonalOutlookAccount(userInfo) : null;
      
      // 2. Probar estrategia de cuentas personales
      const calendars = await getPersonalOutlookCalendars(accessToken);
      
      // 3. Verificar si encontró "consultorías"
      const consultoriasCalendar = calendars.find(cal => 
        cal.name.toLowerCase().includes('consultor')
      );
      
      const result = {
        userInfo: userInfo ? {
          email: userInfo.mail || userInfo.userPrincipalName,
          accountType: isPersonal ? 'personal' : 'business/unknown'
        } : null,
        calendarsFound: calendars.length,
        calendars: calendars.map(cal => ({
          id: cal.id,
          name: cal.name,
          isPrimary: cal.isDefaultCalendar,
          source: cal.source
        })),
        consultoriasFound: !!consultoriasCalendar,
        consultoriasDetails: consultoriasCalendar || null,
        strategy: 'personal_outlook_specialized'
      };

      console.log('✅ [TEST] Personal strategy test completed:', {
        isPersonal,
        calendarsFound: calendars.length,
        consultoriasFound: !!consultoriasCalendar
      });

      return res.status(HTTPSTATUS.OK).json({
        message: "Personal Outlook strategy test completed",
        userId,
        result,
        success: true,
        recommendation: consultoriasCalendar 
          ? "✅ SUCCESS: 'consultorías' calendar found with personal strategy!"
          : "⚠️ PARTIAL: Strategy works but 'consultorías' not found - may need to create events first"
      });

    } catch (error) {
      console.error('❌ [TEST] Error testing personal strategy:', error);
      return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: "Personal strategy test failed",
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  }
);

export const verifyRefreshTokenController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;

    console.log('🔍 Verifying refresh token for user:', userId);

    try {
      const integrationRepository = AppDataSource.getRepository(Integration);

      // Buscar integración de Microsoft
      const integration = await integrationRepository.findOne({
        where: {
          userId: userId,
          provider: IntegrationProviderEnum.MICROSOFT,
          app_type: IntegrationAppTypeEnum.OUTLOOK_CALENDAR,
          isConnected: true
        }
      });

      if (!integration) {
        return res.status(HTTPSTATUS.NOT_FOUND).json({
          message: "Microsoft integration not found",
          result: {
            hasIntegration: false,
            hasAccessToken: false,
            hasRefreshToken: false,
            tokenStatus: 'NO_INTEGRATION'
          },
          recommendation: "Execute Request #11 to disconnect, then #3 to reconnect with offline_access scope",
          success: false
        });
      }

      // Analizar tokens
      const now = Date.now();
      const hasAccessToken = !!integration.access_token;
      const hasRefreshToken = !!integration.refresh_token;
      const isExpired = integration.expiry_date ? now >= integration.expiry_date : true;
      const timeToExpiry = integration.expiry_date ? integration.expiry_date - now : null;

      let tokenStatus = 'UNKNOWN';
      if (!hasAccessToken) {
        tokenStatus = 'NO_ACCESS_TOKEN';
      } else if (!hasRefreshToken) {
        tokenStatus = 'NO_REFRESH_TOKEN'; // ← ESTE ES TU PROBLEMA
      } else if (isExpired) {
        tokenStatus = 'EXPIRED_BUT_RENEWABLE';
      } else {
        tokenStatus = 'VALID';
      }

      // Intentar validar access token actual
      let accessTokenValid = false;
      if (hasAccessToken) {
        try {
          const testResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { 'Authorization': `Bearer ${integration.access_token}` }
          });
          accessTokenValid = testResponse.ok;
        } catch (error) {
          accessTokenValid = false;
        }
      }

      const result = {
        hasIntegration: true,
        integrationId: integration.id,
        hasAccessToken,
        hasRefreshToken,
        accessTokenValid,
        tokenStatus,
        isExpired,
        timeToExpiryMinutes: timeToExpiry ? Math.floor(timeToExpiry / (60 * 1000)) : null,
        expiryDate: integration.expiry_date ? new Date(integration.expiry_date).toISOString() : null,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
        metadata: integration.metadata
      };

      // Generar recomendaciones específicas
      let recommendation = '';
      if (!hasRefreshToken) {
        recommendation = "🚨 CRITICAL: No refresh token! Reconnect with 'offline_access' scope. " +
                        "Execute: #11 (disconnect) → Update .env → #3 (reconnect) → #16 (verify)";
      } else if (isExpired && hasRefreshToken) {
        recommendation = "⚠️ Token expired but renewable. The system should auto-refresh on next API call.";
      } else if (!accessTokenValid) {
        recommendation = "❌ Access token invalid. Check network or try manual refresh.";
      } else {
        recommendation = "✅ All tokens healthy! Integration ready to use.";
      }

      console.log('🔍 Token verification completed:', {
        tokenStatus,
        hasRefreshToken,
        accessTokenValid,
        isExpired
      });

      return res.status(HTTPSTATUS.OK).json({
        message: "Token verification completed",
        userId,
        result,
        recommendation,
        success: true
      });

    } catch (error) {
      console.error('❌ Error verifying tokens:', error);
      return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: "Token verification failed",
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  }
);