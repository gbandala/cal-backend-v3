import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middeware";
import { HTTPSTATUS } from "../config/http.config";
import {
  checkIntegrationService,
  connectAppService,
  createIntegrationService,
  getUserIntegrationsService,
} from "../services/integration.service";
import { asyncHandlerAndValidation } from "../middlewares/withValidation.middleware";
import { AppTypeDTO } from "../database/dto/integration.dto";
import { config } from "../config/app.config";
import { decodeState } from "../utils/helper";
import { googleOAuth2Client } from "../config/oauth.config";
import {
  Integration,
} from "../database/entities/integration.entity";
import { IntegrationAppTypeEnum, IntegrationProviderEnum, IntegrationCategoryEnum } from "../enums/integration.enum";
import { zoomOAuth2Client } from "../config/oauth.config";
import { getMicrosoftUserInfo, getOutlookCalendars } from "../services/outlook.service";
// import { syncOutlookCalendarsService, createDefaultCalendarForUser } from "../services/user-calendars.service";
import { CalendarService } from "../services/calendar.service";
import { UserCalendar } from "../database/entities/user-calendar.entity"; 
import { AppDataSource } from "../config/database.config";

const CLIENT_APP_URL = config.FRONTEND_INTEGRATION_URL;
const calendarService = new CalendarService();

export const getUserIntegrationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;

    const integrations = await getUserIntegrationsService(userId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Fetched user integrations successfully",
      integrations,
    });
  }
);

export const checkIntegrationController = asyncHandlerAndValidation(
  AppTypeDTO,
  "params",
  async (req: Request, res: Response, appTypeDto) => {
    const userId = req.user?.id as string;

    const isConnected = await checkIntegrationService(
      userId,
      appTypeDto.appType
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Integration checked successfully",
      isConnected,
    });
  }
);

export const connectAppController = asyncHandlerAndValidation(
  AppTypeDTO,
  "params",
  async (req: Request, res: Response, appTypeDto) => {
    const userId = req.user?.id as string;

    const { url } = await connectAppService(userId, appTypeDto.appType);

    return res.status(HTTPSTATUS.OK).json({
      url,
    });
  }
);

export const googleOAuthCallbackController = asyncHandler(
  async (req: Request, res: Response) => {
    const { code, state } = req.query;

    const CLIENT_URL = `${CLIENT_APP_URL}?app_type=google`;

    if (!code || typeof code !== "string") {
      return res.redirect(`${CLIENT_URL}&error=Invalid authorization`);
    }

    if (!state || typeof state !== "string") {
      return res.redirect(`${CLIENT_URL}&error=Invalid state parameter`);
    }

    const { userId } = decodeState(state);

    if (!userId) {
      return res.redirect(`${CLIENT_URL}&error=UserId is required`);
    }

    const { tokens } = await googleOAuth2Client.getToken(code);

    if (!tokens.access_token) {
      return res.redirect(`${CLIENT_URL}&error=Access Token not passed`);
    }

    await createIntegrationService({
      userId: userId,
      provider: IntegrationProviderEnum.GOOGLE,
      category: IntegrationCategoryEnum.CALENDAR_AND_VIDEO_CONFERENCING,
      app_type: IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || null,
      metadata: {
        scope: tokens.scope,
        token_type: tokens.token_type,
      },
    });

    return res.redirect(`${CLIENT_URL}&success=true`);
  }
);

export const zoomOAuthCallbackController = asyncHandler(
  async (req: Request, res: Response) => {
    const { code, state } = req.query;

    // console.log('query params:', req.query);

    const CLIENT_URL = `${CLIENT_APP_URL}?app_type=zoom`;
    // console.log('CLIENT_URL:', CLIENT_URL);

    if (!code || typeof code !== "string") {
      return res.redirect(`${CLIENT_URL}&error=Invalid authorization`);
    }
    console.log('code:', code);
    if (!state || typeof state !== "string") {
      return res.redirect(`${CLIENT_URL}&error=Invalid state parameter`);
    }
    const { userId } = decodeState(state);

    if (!userId) {
      return res.redirect(`${CLIENT_URL}&error=UserId is required`);
    }



    try {
      // Intercambiar código por tokens con Zoom
      console.log('post values:', zoomOAuth2Client.tokenUrl, {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: zoomOAuth2Client.redirectUri
      });
      const tokenResponse = await fetch(zoomOAuth2Client.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${zoomOAuth2Client.clientId}:${zoomOAuth2Client.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: zoomOAuth2Client.redirectUri
        })
      });

      const tokens = await tokenResponse.json();

      console.log('Zoom tokens:', tokens);

      if (!tokens.access_token) {
        return res.redirect(`${CLIENT_URL}&error=Access Token not received from Zoom`);
      }

      // Obtener información del usuario de Zoom
      const userResponse = await fetch('https://api.zoom.us/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });

      const userData = await userResponse.json();
      console.log('Zoom user data:', userData);

      // Crear integración en BD
      await createIntegrationService({
        userId: decodeState(state).userId,
        provider: IntegrationProviderEnum.ZOOM,
        category: IntegrationCategoryEnum.VIDEO_CONFERENCING,
        app_type: IntegrationAppTypeEnum.ZOOM_MEETING,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        expiry_date: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : null,
        metadata: userData,
        zoom_user_id: userData.id,
        zoom_account_id: userData.account_id
      });

      return res.redirect(`${CLIENT_URL}&success=true`);

    } catch (error) {
      console.error('Zoom OAuth callback error:', error);
      return res.redirect(`${CLIENT_URL}&error=Failed to connect Zoom`);
    }
  }
);

export const microsoftCallbackController = async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;
    console.log('-------------------------------------------------------');
    console.log('🔵 Microsoft OAuth Callback Started');

    // Manejar errores de OAuth
    if (error) {
      console.error('❌ Microsoft OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_INTEGRATION_URL}?error=authorization_denied`);
    }

    if (!code || !state) {
      console.error('❌ Missing code or state in Microsoft callback');
      return res.redirect(`${process.env.FRONTEND_INTEGRATION_URL}?error=missing_parameters`);
    }

    // Decodificar estado para obtener userId y appType
    const decodedState = decodeState(state as string);
    const { userId, appType } = decodedState;

    console.log('📋 OAuth data decoded:', {
      userId,
      appType,
      codeLength: (code as string).length
    });

    // 1. INTERCAMBIAR CÓDIGO POR TOKENS
    console.log('🔄 Step 1: Exchanging code for tokens...');
    
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
        scope: process.env.MICROSOFT_SCOPE!
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error('❌ Token exchange failed:', error);
      return res.redirect(`${process.env.FRONTEND_INTEGRATION_URL}?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    console.log('✅ Step 1 Complete - Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      scope: tokens.scope,
      expiresIn: tokens.expires_in
    });

    // 2. OBTENER INFORMACIÓN DEL USUARIO
    console.log('🔄 Step 2: Getting user info...');
    
    const userInfo = await getMicrosoftUserInfo(tokens.access_token);
    console.log('✅ Step 2 Complete - User info received:', {
      email: userInfo.email,
      name: userInfo.displayName,
      accountType: userInfo.email?.includes('outlook.com') ? 'personal' : 'business'
    });

    // 3. SINCRONIZAR CALENDARIOS EN USER_CALENDARS (NUEVO!)
    console.log('🔄 Step 3: Syncing calendars to user_calendars...');
    
    let userCalendarsResult = {
      success: false,
      calendars: [] as any[],
      method: 'none' as string,
      error: null as string | null
    };

    try {
      // const syncedCalendars = await syncOutlookCalendarsService(userId, tokens.access_token);
      const syncedCalendars = await calendarService.syncOutlookCalendarsService(userId, tokens.access_token);
      userCalendarsResult = {
        success: true,
        calendars: syncedCalendars,
        method: 'sync',
        error: null
      };
      console.log('✅ Step 3 Complete - Calendars synced successfully:', {
        calendarsCount: syncedCalendars.length,
        // primaryCalendar: syncedCalendars.find(cal => cal.isPrimary)?.calendarName
        primaryCalendar: syncedCalendars.find((cal: any) => cal.isPrimary)?.calendarName
      });
    } catch (syncError) {
      const errorMessage = syncError instanceof Error ? syncError.message : String(syncError);
      console.warn('⚠️ Step 3 Partial - Calendar sync failed, will create fallback:', errorMessage);
      userCalendarsResult.error = errorMessage;
    }

    // 4. OBTENER CALENDARIOS PARA INTEGRATIONS (Como antes)
    console.log('🔄 Step 4: Getting calendars for integrations table...');
    
    let defaultCalendar: any = null;
    let calendarsForIntegration: any[] = [];

    try {
      calendarsForIntegration = await getOutlookCalendars(tokens.access_token);
      defaultCalendar = calendarsForIntegration.find(cal => cal.isDefaultCalendar) || calendarsForIntegration[0];
      
      console.log('✅ Step 4 Complete - Calendar access for integrations:', {
        calendarsFound: calendarsForIntegration.length,
        defaultCalendar: defaultCalendar?.name
      });
    } catch (calendarError) {
      console.warn(
        '⚠️ Step 4 Fallback - Calendar access limited, using fallback:',
        calendarError instanceof Error ? calendarError.message : String(calendarError)
      );
      
      // Fallback para cuentas personales
      defaultCalendar = {
        id: 'primary',
        name: 'My Calendar',
        isDefaultCalendar: true
      };
    }

    // 5. CREAR INTEGRACIÓN EN BASE DE DATOS
    console.log('🔄 Step 5: Creating integration record...');
    
    const expiryDate = Date.now() + (tokens.expires_in * 1000);

    const integration = await createIntegrationService({
      userId,
      provider: IntegrationProviderEnum.MICROSOFT,
      category: IntegrationCategoryEnum.CALENDAR,
      app_type: appType,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: expiryDate,
      metadata: {
        scope: tokens.scope,
        token_type: tokens.token_type,
        userInfo: userInfo,
        accountType: userInfo.email?.includes('outlook.com') ? 'personal' : 'business',
        calendarSyncResult: userCalendarsResult
      },
      outlook_calendar_id: defaultCalendar?.id,
      outlook_calendar_name: defaultCalendar?.name
    });

    console.log('✅ Step 5 Complete - Integration created:', {
      integrationId: integration.id,
      calendarId: integration.outlook_calendar_id,
      calendarName: integration.outlook_calendar_name
    });

    // 6. CREAR CALENDARIO POR DEFECTO SI NO SE SINCRONIZÓ NINGUNO
    if (!userCalendarsResult.success && defaultCalendar) {
      console.log('🔄 Step 6: Creating fallback calendar in user_calendars...');
      
      try {
        // const fallbackCalendar = await createDefaultCalendarForUser(
        const fallbackCalendar = await calendarService.createDefaultCalendarForUser(
          userId,
          defaultCalendar.id,
          defaultCalendar.name
        );

        userCalendarsResult = {
          success: true,
          calendars: [fallbackCalendar],
          method: 'fallback',
          error: null
        };

        console.log('✅ Step 6 Complete - Fallback calendar created:', {
          calendarId: fallbackCalendar.calendarId,
          calendarName: fallbackCalendar.calendarName
        });
      } catch (fallbackError) {
        console.error('❌ Step 6 Failed - Could not create fallback calendar:', fallbackError);
        // No interrumpir el flujo - la integración principal ya está guardada
      }
    } else {
      console.log('⏭️ Step 6 Skipped - Calendars already synced successfully');
    }

    // 7. RESUMEN FINAL Y REDIRECCIÓN
    console.log('🎉 Microsoft OAuth Integration Complete!');
    console.log('📊 Final Summary:', {
      integrationId: integration.id,
      userCalendarsMethod: userCalendarsResult.method,
      userCalendarsCount: userCalendarsResult.calendars.length,
      userCalendarsSuccess: userCalendarsResult.success,
      accountType: userInfo.email?.includes('outlook.com') ? 'personal' : 'business'
    });
    console.log('-------------------------------------------------------');

    // Redireccionar al frontend con éxito
    res.redirect(`${process.env.FRONTEND_INTEGRATION_URL}?success=microsoft_connected&app_type=${appType}`);

  } catch (error) {
    console.error('💥 Microsoft OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_INTEGRATION_URL}?error=connection_failed`);
  }
};

/**
 * Desconecta una integración específica del usuario
 * DELETE /api/integration/disconnect/:appType
 */
export const disconnectIntegrationController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;
    const { appType } = req.params;

    console.log('🔌 Disconnecting integration:', {
      userId,
      appType
    });

    try {
      const integrationRepository = AppDataSource.getRepository(Integration);
      const userCalendarRepository = AppDataSource.getRepository(UserCalendar);

      // 1. Buscar integración existente
      const integration = await integrationRepository.findOne({
        where: {
          userId: userId,
          app_type: appType as IntegrationAppTypeEnum
        }
      });

      if (!integration) {
        return res.status(HTTPSTATUS.NOT_FOUND).json({
          message: "Integration not found",
          success: false
        });
      }

      // 2. Eliminar calendarios relacionados (para Outlook)
      if (appType === IntegrationAppTypeEnum.OUTLOOK_CALENDAR) {
        const deletedCalendars = await userCalendarRepository.delete({
          userId: userId
        });
        
        console.log('🗑️ Deleted user calendars:', deletedCalendars.affected);
      }

      // 3. Eliminar integración
      await integrationRepository.remove(integration);

      console.log('✅ Integration disconnected successfully:', {
        integrationId: integration.id,
        appType: integration.app_type
      });

      return res.status(HTTPSTATUS.OK).json({
        message: "Integration disconnected successfully",
        disconnectedIntegration: {
          id: integration.id,
          appType: integration.app_type,
          provider: integration.provider
        },
        success: true
      });

    } catch (error) {
      console.error('❌ Error disconnecting integration:', error);
      return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: "Failed to disconnect integration",
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  }
);
