import { title } from "process";
import { AppDataSource } from "../config/database.config";
import {
  Integration,
  IntegrationAppTypeEnum,
  IntegrationCategoryEnum,
  IntegrationProviderEnum,
} from "../database/entities/integration.entity";
import { BadRequestException } from "../utils/app-error";
import { googleOAuth2Client, zoomOAuth2Client } from "../config/oauth.config";
import { encodeState } from "../utils/helper";

/**
 * MAPEOS DE CONFIGURACIÓN ESTÁTICA
 * 
 * Estos mapeos relacionan tipos de aplicación con sus características.
 * Permiten mantener la configuración centralizada y fácil de mantener.
 * Al agregar nuevas integraciones, solo se actualizan estos mapeos.
 */

/**
 * MAPEO: Tipo de App → Proveedor Base
 * 
 * Relaciona cada aplicación específica con su proveedor principal.
 * Ejemplo: Google Meet y Google Calendar ambos usan proveedor GOOGLE
 */
const appTypeToProviderMap: Record<
  IntegrationAppTypeEnum,
  IntegrationProviderEnum
> = {
  [IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR]:
    IntegrationProviderEnum.GOOGLE,
  [IntegrationAppTypeEnum.ZOOM_MEETING]: IntegrationProviderEnum.ZOOM,
  [IntegrationAppTypeEnum.OUTLOOK_CALENDAR]: IntegrationProviderEnum.MICROSOFT,
  [IntegrationAppTypeEnum.OUTLOOK_WITH_ZOOM]: IntegrationProviderEnum.MICROSOFT,
};

/**
 * MAPEO: Tipo de App → Categoría Funcional
 * 
 * Clasifica aplicaciones por su funcionalidad principal.
 * Útil para agrupar en UI y determinar capacidades.
 */
const appTypeToCategoryMap: Record<
  IntegrationAppTypeEnum,
  IntegrationCategoryEnum
> = {
  [IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR]:
    IntegrationCategoryEnum.CALENDAR_AND_VIDEO_CONFERENCING,
  [IntegrationAppTypeEnum.ZOOM_MEETING]:
    IntegrationCategoryEnum.VIDEO_CONFERENCING,
  [IntegrationAppTypeEnum.OUTLOOK_CALENDAR]: IntegrationCategoryEnum.CALENDAR,
  [IntegrationAppTypeEnum.OUTLOOK_WITH_ZOOM]: IntegrationCategoryEnum.CALENDAR_AND_VIDEO_CONFERENCING, // ← NUEVO
};

/**
 * MAPEO: Tipo de App → Título Amigable
 * 
 * Nombres legibles para mostrar en interfaz de usuario.
 * Separado del enum para permitir cambios sin afectar código.
 */
const appTypeToTitleMap: Record<IntegrationAppTypeEnum, string> = {
  [IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR]: "Google Meet & Calendar",
  [IntegrationAppTypeEnum.ZOOM_MEETING]: "Zoom",
  [IntegrationAppTypeEnum.OUTLOOK_CALENDAR]: "Outlook Calendar",
  [IntegrationAppTypeEnum.OUTLOOK_WITH_ZOOM]: "Outlook + Zoom", // ← NUEVO
};

/**
 * SERVICIO PRINCIPAL: Obtener estado completo de integraciones del usuario
 * 
 * @param userId - ID del usuario
 * @returns Array con todas las integraciones disponibles y su estado
 * 
 * PROPÓSITO: Proporcionar vista unificada de qué integraciones están disponibles
 * y cuáles ya están conectadas por el usuario.
 * 
 * FLUJO:
 * 1. Buscar integraciones activas del usuario
 * 2. Crear mapa de conexiones existentes
 * 3. Generar lista completa combinando disponibilidad + estado
 * 4. Retornar estructura uniforme para UI
 */
export const getUserIntegrationsService = async (userId: string) => {
  const integrationRepository = AppDataSource.getRepository(Integration);

  // PASO 1: Obtener todas las integraciones existentes del usuario
  const userIntegrations = await integrationRepository.find({
    where: { user: { id: userId } },
  });

  // PASO 2: Crear mapa de conexiones para búsqueda eficiente O(1)
  // Map<appType, boolean> permite verificar rápidamente si una app está conectada
  const connectedMap = new Map(
    userIntegrations.map((integration) => [integration.app_type, true])
  );

  // PASO 3: Generar lista completa de todas las integraciones disponibles
  // Combina apps disponibles (enum) con estado actual (conectado/no conectado)
  const result = Object.values(IntegrationAppTypeEnum).flatMap((appType) => {
    return {
      provider: appTypeToProviderMap[appType],    // Proveedor base (Google, Zoom, etc.)
      title: appTypeToTitleMap[appType],          // Nombre amigable para UI
      app_type: appType,                          // Identificador único de la app
      category: appTypeToCategoryMap[appType],    // Categoría funcional
      isConnected: connectedMap.has(appType) || false, // Estado actual de conexión
    };
  });

  // console.log('Resultado de getUserIntegrationsService:', result);

  return result;
};

/**
 * SERVICIO: Verificación rápida de integración específica
 * 
 * @param userId - ID del usuario
 * @param appType - Tipo específico de aplicación a verificar
 * @returns boolean - true si está conectada, false si no
 * 
 * USO: Validaciones rápidas antes de usar funcionalidades que requieren integración
 * EJEMPLO: Antes de crear evento con Google Meet, verificar si Google está conectado
 */
export const checkIntegrationService = async (
  userId: string,
  appType: IntegrationAppTypeEnum
) => {
  const integrationRepository = AppDataSource.getRepository(Integration);

  // BÚSQUEDA ESPECÍFICA: Usuario + tipo de app
  const integration = await integrationRepository.findOne({
    where: { user: { id: userId }, app_type: appType },
  });
  console.log(
    `Checking integration for user ${userId} and app ${appType}:`,
    integration ? "Connected" : "Not connected"
  );
  // RETORNO SIMPLE: boolean para lógica condicional
  if (!integration) {
    return false;
  }

  return true;
};

/**
 * SERVICIO: Iniciar proceso de conexión OAuth
 * 
 * @param userId - ID del usuario que quiere conectar la app
 * @param appType - Tipo de aplicación a conectar
 * @returns Objeto con URL de autorización OAuth
 * 
 * PROPÓSITO: Generar URL donde el usuario autoriza la integración
 * 
 * FLUJO OAUTH:
 * 1. Codificar estado con datos del usuario (previene CSRF)
 * 2. Generar URL de autorización según el proveedor
 * 3. Configurar scopes y permisos necesarios
 * 4. Retornar URL para redirección
 */
export const connectAppService = async (
  userId: string,
  appType: IntegrationAppTypeEnum
) => {
  // PASO 1: Codificar estado para callback OAuth
  // El estado incluye userId + appType para identificar la operación
  // cuando OAuth provider hace callback de Google a nuestra aplicación
  const state = encodeState({ userId, appType });
  // console.log("Encoded state for OAuth:", state);

  let authUrl: string;

  // PASO 2: Generar URL según el proveedor específico
  switch (appType) {
    case IntegrationAppTypeEnum.GOOGLE_MEET_AND_CALENDAR:
      // CONFIGURACIÓN GOOGLE OAUTH:
      authUrl = googleOAuth2Client.generateAuthUrl({
        access_type: "offline",    // Permite refresh tokens para renovación automática
        scope: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events'
        ],
        prompt: "consent",         // Fuerza pantalla de consentimiento (obtiene refresh token)
        include_granted_scopes: true,
        state,                     // Estado codificado para callback seguro
      });
      break;

    case IntegrationAppTypeEnum.ZOOM_MEETING:
      authUrl = `${zoomOAuth2Client.authUrl}?` +
        `response_type=code&` +
        `client_id=${zoomOAuth2Client.clientId}&` +
        `redirect_uri=${encodeURIComponent(zoomOAuth2Client.redirectUri)}&` +
        `state=${encodeURIComponent(state)}`;
      console.log("Zoom OAuth URL:", authUrl);
      break;

    case IntegrationAppTypeEnum.OUTLOOK_WITH_ZOOM: // ← NUEVO
      authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${process.env.MICROSOFT_CLIENT_ID}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(process.env.MICROSOFT_REDIRECT_URI!)}&` +
        `scope=${encodeURIComponent(process.env.MICROSOFT_SCOPE!)}&` +
        `state=${encodeURIComponent(state)}`;
      break;
    default:
      // Error para tipos no implementados
      throw new BadRequestException("Unsupported app type");
  }
  // console.log("Generated OAuth URL:", authUrl);
  // PASO 3: Retornar URL para redirección del usuario
  return { url: authUrl };
};

/**
 * SERVICIO: Crear integración tras autorización OAuth exitosa
 * 
 * @param data - Objeto con todos los datos de la integración
 * @returns Integration - Entidad de integración creada
 * 
 * LLAMADO DESDE: Callback OAuth tras autorización del usuario
 * 
 * FLUJO:
 * 1. Validar que la integración no exista previamente
 * 2. Crear entidad con tokens y metadata
 * 3. Marcar como conectada y activa
 * 4. Persistir en base de datos
 */
export const createIntegrationService = async (data: {
  userId: string;
  provider: IntegrationProviderEnum;      // Google, Zoom, Microsoft
  category: IntegrationCategoryEnum;      // Calendar, Video, etc.
  app_type: IntegrationAppTypeEnum;       // Tipo específico de app
  access_token: string;                   // Token para llamadas API inmediatas
  refresh_token?: string;                 // Token para renovar access tokens
  expiry_date: number | null;            // Timestamp de expiración
  metadata: any;                         // Datos adicionales del proveedor
  calendar_id?: string;
  calendar_name?: string;
  zoom_user_id?: string;
  zoom_account_id?: string;
  // ✅ AGREGAR ESTOS CAMPOS:
  outlook_calendar_id?: string;          // ← NUEVO
  outlook_calendar_name?: string;        // ← NUEVO
}) => {
  const integrationRepository = AppDataSource.getRepository(Integration);

  // VALIDACIÓN: Prevenir integraciones duplicadas
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

  // CREACIÓN: Nueva entidad de integración
  const integration = integrationRepository.create({
    provider: data.provider,             // Proveedor base
    category: data.category,             // Categoría funcional
    app_type: data.app_type,             // Tipo específico
    access_token: data.access_token,     // Token de acceso actual
    refresh_token: data.refresh_token,   // Token para renovación (opcional)
    expiry_date: data.expiry_date,       // Cuándo expira el access token
    metadata: data.metadata,             // Información adicional del proveedor
    userId: data.userId,                 // Relación con usuario propietario
    isConnected: true,                   // Marca como activa inmediatamente
    ...(data.provider === IntegrationProviderEnum.GOOGLE && {
      calendar_id: data.calendar_id || 'primary',
      calendar_name: data.calendar_name
    }),
    ...(data.provider === IntegrationProviderEnum.ZOOM && {
      zoom_user_id: data.zoom_user_id,
      zoom_account_id: data.zoom_account_id
    }),
    // ✅ AGREGAR PARA MICROSOFT:
    ...(data.provider === IntegrationProviderEnum.MICROSOFT && {
      outlook_calendar_id: data.outlook_calendar_id,
      outlook_calendar_name: data.outlook_calendar_name
    })
  });

  // PERSISTENCIA: Guardar en base de datos
  await integrationRepository.save(integration);

  return integration;
};

/**
 * SERVICIO ESPECIALIZADO: Validar y renovar tokens de Google
 * 
 * @param accessToken - Token actual de acceso
 * @param refreshToken - Token para renovar
 * @param expiryDate - Timestamp de expiración (o null)
 * @returns string - Token válido (actual o renovado)
 * 
 * PROPÓSITO: Mantener integración Google siempre funcional
 * 
 * ALGORITMO:
 * 1. Verificar si token actual está expirado
 * 2. Si expiró: usar refresh token para obtener nuevo access token
 * 3. Si no: retornar token actual
 * 
 * VENTAJA: Transparente para el usuario - integración siempre funciona
 */
export const validateGoogleToken = async (
  accessToken: string,
  refreshToken: string,
  expiryDate: number | null
) => {
  // VERIFICACIÓN: ¿Token está expirado?
  // expiryDate null = nunca expira (caso especial)
  // Date.now() >= expiryDate = ya expiró
  if (expiryDate === null || Date.now() >= expiryDate) {

    // RENOVACIÓN: Usar refresh token para obtener nuevo access token
    googleOAuth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // LLAMADA API: Solicitar nuevos tokens a Google
    const { credentials } = await googleOAuth2Client.refreshAccessToken();

    // console.log("New access token obtained:", credentials.access_token);
    // RETORNO: Nuevo access token válido
    return credentials.access_token;
  }

  // TOKEN VÁLIDO: Retornar el actual sin cambios
  return accessToken;
};

export const validateZoomToken = async (
  accessToken: string,
  refreshToken: string,
  expiryDate: number | null
) => {
  // Verificar si el token está expirado
  if (expiryDate === null || Date.now() >= expiryDate) {
    // Renovar token con Zoom API
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
    // console.log("New Zoom access token obtained:", data.access_token);
    return data.access_token;
  }

  return accessToken;
};
