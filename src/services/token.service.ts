// services/token.service.ts
import { AppDataSource } from "../config/database.config";
import { Integration} from "../database/entities/integration.entity";
import { IntegrationAppTypeEnum, IntegrationProviderEnum } from "../enums/integration.enum";
import { BadRequestException } from "../utils/app-error";
import { validateMicrosoftToken } from "./outlook.service";

/**
 * SERVICIO DE GESTIÓN DE TOKENS
 * 
 * Maneja la obtención y renovación automática de tokens
 * para diferentes proveedores de integración.
 */

/**
 * Obtiene un token válido de Microsoft para un usuario
 * Renueva automáticamente si es necesario
 */
export const getValidMicrosoftToken = async (userId: string): Promise<string> => {
  const integrationRepository = AppDataSource.getRepository(Integration);

  try {
    console.log('🔍 Getting valid Microsoft token for user:', userId);

    // 1. Buscar integración de Microsoft del usuario
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

    console.log('✅ Found Microsoft integration:', {
      userId,
      integrationId: integration.id,
      hasRefreshToken: !!integration.refresh_token,
      expiryDate: integration.expiry_date
    });

    // 2. Validar y renovar token si es necesario
    const validToken = await validateMicrosoftToken(
      integration.access_token,
      integration.refresh_token,
      integration.expiry_date
    );

    // 3. Si el token fue renovado, actualizar en BD
    if (validToken !== integration.access_token) {
      console.log('🔄 Token was refreshed, updating in database...');
      
      integration.access_token = validToken;
      integration.expiry_date = Date.now() + (3600 * 1000); // 1 hora por defecto
      integration.updatedAt = new Date();
      
      await integrationRepository.save(integration);
      
      console.log('✅ Updated token in database');
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
 * Verifica si un token de Microsoft es válido
 */
export const verifyMicrosoftToken = async (accessToken: string): Promise<boolean> => {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;

  } catch (error) {
    console.error('❌ Error verifying Microsoft token:', error);
    return false;
  }
};

/**
 * Refresca manualmente un token de Microsoft para un usuario
 */
export const refreshMicrosoftTokenForUser = async (userId: string): Promise<string> => {
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

    if (!integration || !integration.refresh_token) {
      throw new BadRequestException('No valid Microsoft integration found for refresh');
    }

    console.log('🔄 Manually refreshing Microsoft token for user:', userId);

    // Forzar renovación usando refresh token
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: integration.refresh_token,
        scope: process.env.MICROSOFT_SCOPE!
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new BadRequestException(`Token refresh failed: ${error.error_description || 'Unknown error'}`);
    }

    const tokenData = await response.json();

    // Actualizar integración con nuevo token
    integration.access_token = tokenData.access_token;
    if (tokenData.refresh_token) {
      integration.refresh_token = tokenData.refresh_token;
    }
    integration.expiry_date = Date.now() + (tokenData.expires_in * 1000);
    integration.updatedAt = new Date();

    await integrationRepository.save(integration);

    console.log('✅ Microsoft token refreshed and saved successfully');

    return tokenData.access_token;

  } catch (error) {
    console.error('❌ Error manually refreshing Microsoft token:', error);
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    throw new BadRequestException(`Failed to refresh Microsoft token: ${errorMessage}`);
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