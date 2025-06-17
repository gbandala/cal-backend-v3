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
import { randomUUID } from "crypto";

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
