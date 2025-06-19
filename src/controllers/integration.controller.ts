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
  IntegrationAppTypeEnum,
  IntegrationCategoryEnum,
  IntegrationProviderEnum,
} from "../database/entities/integration.entity";
import { zoomOAuth2Client } from "../config/oauth.config";
import { getMicrosoftUserInfo, getOutlookCalendars } from "../services/outlook.service";

const CLIENT_APP_URL = config.FRONTEND_INTEGRATION_URL;

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

/**
 * Callback OAuth de Microsoft - maneja la respuesta de autorización
 */
export const microsoftCallbackController = async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;
    console.log('-------------------------------------------------------')

    // Manejar errores de OAuth
    if (error) {
      console.error('Microsoft OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_INTEGRATION_URL}?error=authorization_denied`);
    }

    if (!code || !state) {
      console.error('Missing code or state in Microsoft callback');
      return res.redirect(`${process.env.FRONTEND_INTEGRATION_URL}?error=missing_parameters`);
    }

    // Decodificar estado para obtener userId y appType
    const decodedState = decodeState(state as string);
    const { userId, appType } = decodedState;

    console.log('paso 1: Microsoft OAuth callback:', {
      userId,
      appType,
      cCode: code
    });

    const request = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      code: code as string,
      grant_type: 'authorization_code',
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
      scope: process.env.MICROSOFT_SCOPE!
    });

    console.log('paso 2: Request body for token exchange:', request.toString());
    // Intercambiar código por tokens
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

    // console.log('paso 2:Token response:', tokenResponse);

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error('Failed to exchange code for tokens:', error);
      return res.redirect(`${process.env.FRONTEND_INTEGRATION_URL}?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    console.log('paso 3: Microsoft tokens received:', {
      AccessToken: tokens.access_token,
      RefreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in
    });

    console.log('🔍 Token Details:', {
      scope: tokens.scope, // ← ESTO es clave
      hasRefreshToken: !!tokens.refresh_token,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in
    });

    await testTokenPermissions(tokens.access_token);
    // Obtener información del usuario
    const userInfo = await getMicrosoftUserInfo(tokens.access_token);
    console.log('paso 4:Microsoft user info:', userInfo);

    // // Obtener calendarios disponibles
    const calendars = await getOutlookCalendars(tokens.access_token);
    const defaultCalendar = calendars.find(cal => cal.isDefaultCalendar) || calendars[0];

    console.log('paso 5:Available Outlook calendars:', {
      total: calendars.length,
      defaultCalendar: defaultCalendar?.name
    });

    // Calcular fecha de expiración
    const expiryDate = Date.now() + (tokens.expires_in * 1000);

    // Determinar provider y category según el appType
    let provider: IntegrationProviderEnum;
    let category: IntegrationCategoryEnum;

    switch (appType) {
      case IntegrationAppTypeEnum.OUTLOOK_CALENDAR:
        provider = IntegrationProviderEnum.MICROSOFT;
        category = IntegrationCategoryEnum.CALENDAR;
        break;
      // case IntegrationAppTypeEnum.OUTLOOK_WITH_ZOOM:
      //   provider = IntegrationProviderEnum.MICROSOFT;
      //   category = IntegrationCategoryEnum.CALENDAR_AND_VIDEO_CONFERENCING;
      //   break;
      default:
        console.error('Unsupported app type for Microsoft:', appType);
        return res.redirect(`${process.env.FRONTEND_INTEGRATION_URL}?error=unsupported_app_type`);
    }

    // Crear integración en base de datos
    const integration = await createIntegrationService({
      userId,
      provider,
      category,
      app_type: appType,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: expiryDate,
      metadata: {
        scope: tokens.scope,
        token_type: tokens.token_type,
        userInfo: userInfo
      },
      // Campos específicos de Outlook
      outlook_calendar_id: defaultCalendar?.id,
      outlook_calendar_name: defaultCalendar?.name
    });

    console.log('paso 6:Microsoft integration created successfully:', {
      id: integration.id,
      appType: integration.app_type,
      calendarId: integration.outlook_calendar_id,
      calendarName: integration.outlook_calendar_name
    });

    // Redireccionar al frontend con éxito
    res.redirect(`${process.env.FRONTEND_INTEGRATION_URL}?success=microsoft_connected&app_type=${appType}`);

  } catch (error) {
    console.error('Microsoft OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_INTEGRATION_URL}?error=connection_failed`);
  }
};

const testTokenPermissions = async (accessToken: string) => {
  console.log('🧪 Testing token permissions...');
  
  // Test 1: User Info (ya funciona)
  try {
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    console.log('✅ User Info:', userResponse.status);
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('👤 User Details:', {
        userType: userData.userType,
        accountEnabled: userData.accountEnabled,
        mail: userData.mail,
        userPrincipalName: userData.userPrincipalName
      });
    }
  } catch (error) {
    console.log('❌ User Info failed:', error);
  }

  // Test 2: Calendars (el que falla) - Con más detalles
  try {
    console.log('📅 Testing calendars endpoint...');
    const calendarsResponse = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'ConsistencyLevel': 'eventual'
      }
    });
    
    console.log('📅 Calendars API Response:', {
      status: calendarsResponse.status,
      statusText: calendarsResponse.statusText,
      headers: Object.fromEntries(calendarsResponse.headers.entries())
    });

    if (!calendarsResponse.ok) {
      const errorText = await calendarsResponse.text();
      console.log('❌ Raw Calendars Error:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.log('❌ Parsed Calendars Error:', errorJson);
      } catch (e) {
        console.log('❌ Could not parse error as JSON');
      }
    } else {
      const calendarsData = await calendarsResponse.json();
      console.log('✅ Calendars Success:', calendarsData);
    }
  } catch (error) {
    console.log('❌ Calendars Exception:', error);
  }

  // Test 3: Alternative calendar endpoint (singular)
  try {
    console.log('📅 Testing singular calendar endpoint...');
    const altResponse = await fetch('https://graph.microsoft.com/v1.0/me/calendar', {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📅 Alternative Calendar API:', {
      status: altResponse.status,
      statusText: altResponse.statusText
    });

    if (altResponse.ok) {
      const calendarData = await altResponse.json();
      console.log('✅ Single Calendar Success:', {
        id: calendarData.id,
        name: calendarData.name,
        canEdit: calendarData.canEdit
      });
    }
  } catch (error) {
    console.log('❌ Alternative Calendar failed:', error);
  }

  // Test 4: Verificar permisos otorgados
  try {
    console.log('🔐 Testing permissions endpoint...');
    const permissionsResponse = await fetch('https://graph.microsoft.com/v1.0/me/oauth2PermissionGrants', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (permissionsResponse.ok) {
      const permissions = await permissionsResponse.json();
      console.log('🔐 Granted Permissions:', permissions.value);
    } else {
      console.log('❌ Could not fetch permissions:', permissionsResponse.status);
    }
  } catch (error) {
    console.log('❌ Permissions check failed:', error);
  }

  // Test 5: Probar endpoint básico de eventos
  try {
    console.log('📅 Testing events endpoint...');
    const eventsResponse = await fetch('https://graph.microsoft.com/v1.0/me/events?$top=1', {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📅 Events API:', {
      status: eventsResponse.status,
      statusText: eventsResponse.statusText
    });

    if (eventsResponse.ok) {
      const eventsData = await eventsResponse.json();
      console.log('✅ Events Success, count:', eventsData.value?.length || 0);
    }
  } catch (error) {
    console.log('❌ Events test failed:', error);
  }
};