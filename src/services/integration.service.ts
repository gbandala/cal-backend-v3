import { AppDataSource } from "../config/database.config";
import {
  Integration,
} from "../database/entities/integration.entity";
import {
  IntegrationAppTypeEnum,
  IntegrationCategoryEnum,
  IntegrationProviderEnum,
} from "../enums/integration.enum";
import { BadRequestException } from "../utils/app-error";
import { googleOAuth2Client, zoomOAuth2Client } from "../config/oauth.config";
import { encodeState } from "../utils/helper";
import { validateMicrosoftToken } from "./outlook.service"; // Importar desde outlook service consolidado

const appTypeToProviderMap: Record<
  IntegrationAppTypeEnum,
  IntegrationProviderEnum
> = {
  [IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR]:
    IntegrationProviderEnum.GOOGLE,
  [IntegrationAppTypeEnum.ZOOM_MEETING]: IntegrationProviderEnum.ZOOM,
  [IntegrationAppTypeEnum.OUTLOOK_CALENDAR]: IntegrationProviderEnum.MICROSOFT,
  [IntegrationAppTypeEnum.OUTLOOK_WITH_ZOOM]: IntegrationProviderEnum.MICROSOFT,
  [IntegrationAppTypeEnum.OUTLOOK_WITH_TEAMS]: IntegrationProviderEnum.MICROSOFT,
  [IntegrationAppTypeEnum.ZOOM_GOOGLE_CALENDAR]: IntegrationProviderEnum.GOOGLE,
};

const appTypeToCategoryMap: Record<
  IntegrationAppTypeEnum,
  IntegrationCategoryEnum
> = {
  [IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR]: IntegrationCategoryEnum.CALENDAR_AND_VIDEO_CONFERENCING,
  [IntegrationAppTypeEnum.ZOOM_MEETING]: IntegrationCategoryEnum.CALENDAR_AND_VIDEO_CONFERENCING,
  [IntegrationAppTypeEnum.OUTLOOK_CALENDAR]: IntegrationCategoryEnum.CALENDAR_AND_VIDEO_CONFERENCING,
  [IntegrationAppTypeEnum.OUTLOOK_WITH_ZOOM]: IntegrationCategoryEnum.CALENDAR,
  [IntegrationAppTypeEnum.OUTLOOK_WITH_TEAMS]: IntegrationCategoryEnum.CALENDAR,
  [IntegrationAppTypeEnum.ZOOM_GOOGLE_CALENDAR]: IntegrationCategoryEnum.CALENDAR
};

const appTypeToTitleMap: Record<IntegrationAppTypeEnum, string> = {
  [IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR]: "Google Calendar",
  [IntegrationAppTypeEnum.ZOOM_MEETING]: "Zoom",
  [IntegrationAppTypeEnum.OUTLOOK_CALENDAR]: "Outlook Calendar",
  [IntegrationAppTypeEnum.OUTLOOK_WITH_ZOOM]: "Outlook + Zoom",
  [IntegrationAppTypeEnum.OUTLOOK_WITH_TEAMS]: "Outlook + Teams",
  [IntegrationAppTypeEnum.ZOOM_GOOGLE_CALENDAR]: "Google Calendar + Zoom"
};

// ============================================
// 🎯 SERVICIOS PRINCIPALES DE INTEGRACIÓN
// ============================================

export const getUserIntegrationsService = async (userId: string) => {
  const integrationRepository = AppDataSource.getRepository(Integration);

  const userIntegrations = await integrationRepository.find({
    where: { user: { id: userId } },
  });

  const connectedMap = new Map(
    userIntegrations.map((integration) => [integration.app_type, true])
  );

  const calendarAndVideoAppTypes = Object.values(IntegrationAppTypeEnum).filter(
    (appType) => appTypeToCategoryMap[appType] === "CALENDAR_AND_VIDEO_CONFERENCING"
  );

  const result = calendarAndVideoAppTypes.flatMap((appType) => {
    return {
      provider: appTypeToProviderMap[appType],
      title: appTypeToTitleMap[appType],
      app_type: appType,
      category: appTypeToCategoryMap[appType],
      isConnected: connectedMap.has(appType) || false,
    };
  });

  return result;
};

export const checkIntegrationService = async (
  userId: string,
  appType: IntegrationAppTypeEnum
) => {
  const integrationRepository = AppDataSource.getRepository(Integration);

  const integration = await integrationRepository.findOne({
    where: { user: { id: userId }, app_type: appType },
  });

  console.log(
    `Checking integration for user ${userId} and app ${appType}:`,
    integration ? "Connected" : "Not connected"
  );

  return !!integration;
};

export const connectAppService = async (
  userId: string,
  appType: IntegrationAppTypeEnum
) => {
  const state = encodeState({ userId, appType });
  let authUrl: string;

  switch (appType) {
    case IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR:
      authUrl = googleOAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events'
        ],
        prompt: "consent",
        include_granted_scopes: true,
        state,
      });
      break;

    case IntegrationAppTypeEnum.ZOOM_MEETING:
      authUrl = `${zoomOAuth2Client.authUrl}?` +
        `response_type=code&` +
        `client_id=${zoomOAuth2Client.clientId}&` +
        `redirect_uri=${encodeURIComponent(zoomOAuth2Client.redirectUri)}&` +
        `state=${encodeURIComponent(state)}`;
      break;

    case IntegrationAppTypeEnum.OUTLOOK_CALENDAR:
      const microsoftScope = process.env.MICROSOFT_SCOPE ||
        'https://graph.microsoft.com/User.Read https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/Calendars.ReadBasic';

      if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_REDIRECT_URI) {
        throw new BadRequestException("Microsoft OAuth configuration missing");
      }

      authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${encodeURIComponent(process.env.MICROSOFT_CLIENT_ID)}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(process.env.MICROSOFT_REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(microsoftScope)}&` +
        `response_mode=query&` +
        `state=${encodeURIComponent(state)}&` +
        `prompt=consent&` +
        `access_type=offline`;
      break;

    default:
      throw new BadRequestException("Unsupported app type");
  }

  return { url: authUrl };
};

export const createIntegrationService = async (data: {
  userId: string;
  provider: IntegrationProviderEnum;
  category: IntegrationCategoryEnum;
  app_type: IntegrationAppTypeEnum;
  access_token: string;
  refresh_token?: string;
  expiry_date: number | null;
  metadata: any;
  calendar_id?: string;
  calendar_name?: string;
  zoom_user_id?: string;
  zoom_account_id?: string;
  outlook_calendar_id?: string;
  outlook_calendar_name?: string;
}) => {
  const integrationRepository = AppDataSource.getRepository(Integration);

  const existingIntegration = await integrationRepository.findOne({
    where: {
      userId: data.userId,
      app_type: data.app_type,
    },
  });

  if (existingIntegration) {
    console.log(`${data.app_type} already connected for user ${data.userId}`);
    throw new BadRequestException(`${data.app_type} already connected`);
  }

  const integration = integrationRepository.create({
    provider: data.provider,
    category: data.category,
    app_type: data.app_type,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: data.expiry_date,
    metadata: data.metadata,
    userId: data.userId,
    isConnected: true,
    ...(data.provider === IntegrationProviderEnum.GOOGLE && {
      calendar_id: data.calendar_id || 'primary',
      calendar_name: data.calendar_name
    }),
    ...(data.provider === IntegrationProviderEnum.ZOOM && {
      zoom_user_id: data.zoom_user_id,
      zoom_account_id: data.zoom_account_id
    }),
    ...(data.provider === IntegrationProviderEnum.MICROSOFT && {
      outlook_calendar_id: data.outlook_calendar_id,
      outlook_calendar_name: data.outlook_calendar_name
    })
  });

  await integrationRepository.save(integration);
  return integration;
};

// ============================================
// 🔧 SERVICIOS DE VALIDACIÓN DE TOKENS
// ============================================

export const validateGoogleToken = async (
  accessToken: string,
  refreshToken: string,
  expiryDate: number | null
) => {
  if (expiryDate === null || Date.now() >= expiryDate) {
    googleOAuth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await googleOAuth2Client.refreshAccessToken();
    return credentials.access_token;
  }

  return accessToken;
};

export const validateZoomToken = async (
  accessToken: string,
  refreshToken: string,
  expiryDate: number | null
) => {
  if (expiryDate === null || Date.now() >= expiryDate) {
    const response = await fetch(zoomOAuth2Client.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${zoomOAuth2Client.clientId}:${zoomOAuth2Client.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    const data = await response.json();
    return data.access_token;
  }

  return accessToken;
};

// ============================================
// 🎯 FUNCIONES CONSOLIDADAS DE TOKEN SERVICE
// ============================================

/**
 * Obtiene un token válido de Microsoft para un usuario
 * Renueva automáticamente si es necesario
 */
export const getValidMicrosoftToken = async (userId: string): Promise<string> => {
  const integrationRepository = AppDataSource.getRepository(Integration);

  try {
    console.log('🔍 Getting valid Microsoft token for user:', userId);

    const integration = await integrationRepository.findOne({
      where: {
        userId: userId,
        provider: IntegrationProviderEnum.MICROSOFT,
        app_type: IntegrationAppTypeEnum.OUTLOOK_CALENDAR,
        isConnected: true
      }
    });

    if (!integration) {
      throw new BadRequestException('Microsoft integration not found for user');
    }

    if (!integration.refresh_token) {
      throw new BadRequestException('No refresh token available for Microsoft integration');
    }

    const validToken = await validateMicrosoftToken(
      integration.access_token,
      integration.refresh_token,
      integration.expiry_date
    );

    // Si el token fue renovado, actualizar en BD
    if (validToken !== integration.access_token) {
      console.log('🔄 Token was refreshed, updating in database...');

      integration.access_token = validToken;
      integration.expiry_date = Date.now() + (3600 * 1000);
      integration.updatedAt = new Date();

      await integrationRepository.save(integration);
    }

    return validToken;

  } catch (error) {
    console.error('❌ Error getting valid Microsoft token:', error);
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    throw new BadRequestException(`Failed to get valid Microsoft token: ${errorMessage}`);
  }
};

/**
 * Obtiene información de la integración de Microsoft de un usuario
 */
export const getMicrosoftIntegration = async (userId: string): Promise<Integration | null> => {
  const integrationRepository = AppDataSource.getRepository(Integration);

  try {
    const integration = await integrationRepository.findOne({
      where: {
        userId: userId,
        provider: IntegrationProviderEnum.MICROSOFT,
        app_type: IntegrationAppTypeEnum.OUTLOOK_CALENDAR,
        isConnected: true
      }
    });

    return integration;

  } catch (error) {
    console.error('❌ Error getting Microsoft integration:', error);
    return null;
  }
};

/**
 * Obtiene estadísticas de tokens de un usuario
 */
export const getTokenStatsForUser = async (userId: string) => {
  const integrationRepository = AppDataSource.getRepository(Integration);

  try {
    const integrations = await integrationRepository.find({
      where: { userId: userId, isConnected: true }
    });

    const stats = integrations.map(integration => {
      const now = Date.now();
      const isExpired = integration.expiry_date ? now >= integration.expiry_date : false;
      const timeToExpiry = integration.expiry_date ? integration.expiry_date - now : null;

      return {
        provider: integration.provider,
        appType: integration.app_type,
        hasRefreshToken: !!integration.refresh_token,
        isExpired,
        timeToExpiryMinutes: timeToExpiry ? Math.floor(timeToExpiry / (1000 * 60)) : null,
        lastUpdated: integration.updatedAt
      };
    });

    return stats;

  } catch (error) {
    console.error('❌ Error getting token stats:', error);
    return [];
  }
};