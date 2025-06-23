// controllers/user-calendars.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middeware";
import { HTTPSTATUS } from "../config/http.config";
import {
  getUserCalendarsService,
  syncOutlookCalendarsService,
  getPrimaryUserCalendarService,
  getCalendarStatsService
} from "../services/user-calendars.service";
import { getValidMicrosoftToken, getMicrosoftIntegration } from "../services/token.service";
import { 
  checkIntegrationService
} from "../services/integration.service";
// import { IntegrationAppTypeEnum } from "../database/entities/integration.entity";
import { IntegrationAppTypeEnum } from "../enums/integration.enum";

/**
 * CONTROLLER PARA GESTIÓN DE CALENDARIOS DE USUARIO
 * 
 * Endpoints REST para obtener, sincronizar y gestionar calendarios
 * de usuario para diferentes proveedores (Google, Outlook, etc.)
 */

/**
 * Obtiene todos los calendarios activos del usuario
 * GET /api/user-calendars
 */
export const getUserCalendarsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;

    console.log('📅 Getting calendars for user:', userId);

    try {
      const calendars = await getUserCalendarsService(userId);

      return res.status(HTTPSTATUS.OK).json({
        message: "User calendars retrieved successfully",
        data: calendars.map(calendar => ({
          id: calendar.id,
          calendarId: calendar.calendarId,
          calendarName: calendar.calendarName,
          isPrimary: calendar.isPrimary,
          accessRole: calendar.accessRole,
          backgroundColor: calendar.backgroundColor,
          isActive: calendar.isActive,
          lastSynced: calendar.lastSynced,
          createdAt: calendar.createdAt,
          updatedAt: calendar.updatedAt
        })),
        count: calendars.length,
        success: true
      });

    } catch (error) {
      console.error('❌ Error getting user calendars:', error);
      return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: "Failed to retrieve user calendars",
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  }
);

/**
 * Obtiene el calendario primario del usuario
 * GET /api/user-calendars/primary
 */
export const getPrimaryCalendarController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;

    console.log('🎯 Getting primary calendar for user:', userId);

    try {
      const primaryCalendar = await getPrimaryUserCalendarService(userId);

      if (!primaryCalendar) {
        return res.status(HTTPSTATUS.NOT_FOUND).json({
          message: "No primary calendar found for user",
          data: null,
          success: false
        });
      }

      return res.status(HTTPSTATUS.OK).json({
        message: "Primary calendar retrieved successfully",
        data: {
          id: primaryCalendar.id,
          calendarId: primaryCalendar.calendarId,
          calendarName: primaryCalendar.calendarName,
          isPrimary: primaryCalendar.isPrimary,
          accessRole: primaryCalendar.accessRole,
          backgroundColor: primaryCalendar.backgroundColor,
          isActive: primaryCalendar.isActive,
          lastSynced: primaryCalendar.lastSynced,
          createdAt: primaryCalendar.createdAt,
          updatedAt: primaryCalendar.updatedAt
        },
        success: true
      });

    } catch (error) {
      console.error('❌ Error getting primary calendar:', error);
      return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: "Failed to retrieve primary calendar",
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  }
);

/**
 * Sincroniza calendarios de Outlook del usuario
 * POST /api/user-calendars/sync/outlook
 */
export const syncOutlookCalendarsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;

    console.log('🔄 Starting Outlook calendar sync for user:', userId);

    try {
      // 1. Verificar que el usuario tenga integración de Outlook
      const hasOutlookIntegration = await checkIntegrationService(
        userId, 
        IntegrationAppTypeEnum.OUTLOOK_CALENDAR
      );

      if (!hasOutlookIntegration) {
        return res.status(HTTPSTATUS.BAD_REQUEST).json({
          message: "User does not have Outlook integration connected",
          error: "OUTLOOK_INTEGRATION_NOT_FOUND",
          success: false
        });
      }

      // 2. Obtener token válido de Microsoft
      const validToken = await getValidMicrosoftToken(userId);

      // 3. Sincronizar calendarios
      const syncedCalendars = await syncOutlookCalendarsService(userId, validToken);

      console.log('✅ Outlook calendar sync completed:', {
        userId,
        calendarsCount: syncedCalendars.length
      });

      return res.status(HTTPSTATUS.OK).json({
        message: "Outlook calendars synchronized successfully",
        data: syncedCalendars.map(calendar => ({
          id: calendar.id,
          calendarId: calendar.calendarId,
          calendarName: calendar.calendarName,
          isPrimary: calendar.isPrimary,
          accessRole: calendar.accessRole,
          backgroundColor: calendar.backgroundColor,
          isActive: calendar.isActive,
          lastSynced: calendar.lastSynced
        })),
        syncedCount: syncedCalendars.length,
        syncedAt: new Date().toISOString(),
        success: true
      });

    } catch (error) {
      console.error('❌ Error syncing Outlook calendars:', error);
      
      // Determinar el tipo de error para respuesta más específica
      let errorCode = "SYNC_FAILED";
      let statusCode = HTTPSTATUS.INTERNAL_SERVER_ERROR;
      let errorMessage = error instanceof Error ? error.message : String(error);

      if (error instanceof Error && error.message.includes('integration not found')) {
        errorCode = "INTEGRATION_NOT_FOUND";
        statusCode = HTTPSTATUS.NOT_FOUND;
      } else if (error instanceof Error && error.message.includes('token')) {
        errorCode = "TOKEN_ERROR";
        statusCode = HTTPSTATUS.UNAUTHORIZED;
      }

      return res.status(statusCode).json({
        message: "Failed to synchronize Outlook calendars",
        error: errorMessage,
        errorCode,
        success: false
      });
    }
  }
);

/**
 * Obtiene estadísticas de calendarios del usuario
 * GET /api/user-calendars/stats
 */
export const getCalendarStatsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;

    console.log('📊 Getting calendar stats for user:', userId);

    try {
      const stats = await getCalendarStatsService(userId);

      // Obtener también información de integración para stats completas
      const microsoftIntegration = await getMicrosoftIntegration(userId);

      const enhancedStats = {
        ...stats,
        integrationInfo: microsoftIntegration ? {
          hasIntegration: true,
          provider: microsoftIntegration.provider,
          appType: microsoftIntegration.app_type,
          isConnected: microsoftIntegration.isConnected,
          createdAt: microsoftIntegration.createdAt,
          lastUpdated: microsoftIntegration.updatedAt
        } : {
          hasIntegration: false
        }
      };

      return res.status(HTTPSTATUS.OK).json({
        message: "Calendar statistics retrieved successfully",
        data: enhancedStats,
        success: true
      });

    } catch (error) {
      console.error('❌ Error getting calendar stats:', error);
      return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: "Failed to retrieve calendar statistics",
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  }
);

/**
 * Fuerza una resincronización completa de calendarios de Outlook
 * POST /api/user-calendars/force-sync
 */
export const forceResyncCalendarsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;

    console.log('🔄 Force resyncing all calendars for user:', userId);

    try {
      // Verificar integración de Outlook
      const microsoftIntegration = await getMicrosoftIntegration(userId);
      
      if (!microsoftIntegration) {
        return res.status(HTTPSTATUS.NOT_FOUND).json({
          message: "Microsoft integration not found",
          error: "INTEGRATION_NOT_FOUND",
          success: false
        });
      }

      // Obtener token válido
      const validToken = await getValidMicrosoftToken(userId);

      // Sincronizar calendarios
      const syncedCalendars = await syncOutlookCalendarsService(userId, validToken);

      console.log('✅ Force resync completed:', {
        userId,
        calendarsCount: syncedCalendars.length
      });

      return res.status(HTTPSTATUS.OK).json({
        message: "Calendars force resynced successfully",
        data: syncedCalendars.map(calendar => ({
          id: calendar.id,
          calendarId: calendar.calendarId,
          calendarName: calendar.calendarName,
          isPrimary: calendar.isPrimary,
          accessRole: calendar.accessRole,
          backgroundColor: calendar.backgroundColor,
          isActive: calendar.isActive,
          lastSynced: calendar.lastSynced
        })),
        syncedCount: syncedCalendars.length,
        syncType: "force_resync",
        syncedAt: new Date().toISOString(),
        success: true
      });

    } catch (error) {
      console.error('❌ Error in force resync:', error);
      return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: "Failed to force resync calendars",
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  }
);

/**
 * Healthcheck específico para calendarios del usuario
 * GET /api/user-calendars/health
 */
export const calendarHealthController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;

    try {
      const calendars = await getUserCalendarsService(userId);
      const microsoftIntegration = await getMicrosoftIntegration(userId);
      
      const health = {
        calendarsCount: calendars.length,
        hasActiveCalendars: calendars.some(cal => cal.isActive),
        hasPrimaryCalendar: calendars.some(cal => cal.isPrimary),
        hasMicrosoftIntegration: !!microsoftIntegration,
        integrationConnected: microsoftIntegration?.isConnected || false,
        lastSync: calendars
          .filter(cal => cal.lastSynced)
          .sort((a, b) => b.lastSynced!.getTime() - a.lastSynced!.getTime())[0]?.lastSynced || null,
        status: calendars.length > 0 ? 'healthy' : 'needs_setup'
      };

      return res.status(HTTPSTATUS.OK).json({
        message: "Calendar health check completed",
        data: health,
        success: true
      });

    } catch (error) {
      console.error('❌ Error in calendar health check:', error);
      return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: "Calendar health check failed",
        error: error instanceof Error ? error.message : String(error),
        data: {
          status: 'error'
        },
        success: false
      });
    }
  }
);