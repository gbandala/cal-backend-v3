// routes/user-calendars.routes.ts
import { Router } from 'express';
import {
  getUserCalendarsController,
  getPrimaryCalendarController,
  syncOutlookCalendarsController,
  getCalendarStatsController,
  forceResyncCalendarsController,
  calendarHealthController
} from '../controllers/user-calendars.controller';

// IMPORTANTE: Reemplaza esto con tu middleware de autenticación actual
// import { authMiddleware } from '../middlewares/auth.middleware';
// Si usas un middleware diferente, ajusta la importación:
// import { authenticateToken } from '../middlewares/authenticate.middleware';
// import { verifyJWT } from '../middlewares/jwt.middleware';

const router = Router();

/**
 * RUTAS PARA GESTIÓN DE CALENDARIOS DE USUARIO
 * 
 * Todas las rutas requieren autenticación
 * Base URL: /api/user-calendars
 */

// ⚠️ IMPORTANTE: Descomentar y ajustar según tu middleware de auth
// router.use(authMiddleware); // ← Reemplazar con tu middleware de autenticación

/**
 * GET /api/user-calendars
 * Obtiene todos los calendarios activos del usuario
 * 
 * Response:
 * {
 *   "message": "User calendars retrieved successfully",
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "calendarId": "primary",
 *       "calendarName": "My Calendar",
 *       "isPrimary": true,
 *       "accessRole": "owner",
 *       "backgroundColor": "#0078d4",
 *       "isActive": true,
 *       "lastSynced": "2025-06-19T10:30:00Z"
 *     }
 *   ],
 *   "count": 1,
 *   "success": true
 * }
 */
router.get('/', getUserCalendarsController);

/**
 * GET /api/user-calendars/primary
 * Obtiene el calendario primario del usuario
 * 
 * Response:
 * {
 *   "message": "Primary calendar retrieved successfully", 
 *   "data": {
 *     "id": "uuid",
 *     "calendarId": "primary",
 *     "calendarName": "My Calendar",
 *     "isPrimary": true,
 *     ...
 *   },
 *   "success": true
 * }
 */
router.get('/primary', getPrimaryCalendarController);

/**
 * GET /api/user-calendars/stats
 * Obtiene estadísticas completas de calendarios del usuario
 * 
 * Response:
 * {
 *   "message": "Calendar statistics retrieved successfully",
 *   "data": {
 *     "totalCalendars": 1,
 *     "activeCalendars": 1,
 *     "inactiveCalendars": 0,
 *     "primaryCalendar": "My Calendar",
 *     "integrationInfo": {
 *       "hasIntegration": true,
 *       "provider": "MICROSOFT",
 *       "appType": "OUTLOOK_CALENDAR",
 *       "isConnected": true
 *     }
 *   },
 *   "success": true
 * }
 */
router.get('/stats', getCalendarStatsController);

/**
 * GET /api/user-calendars/health
 * Health check específico para calendarios del usuario
 * 
 * Response:
 * {
 *   "message": "Calendar health check completed",
 *   "data": {
 *     "calendarsCount": 1,
 *     "hasActiveCalendars": true,
 *     "hasPrimaryCalendar": true,
 *     "hasMicrosoftIntegration": true,
 *     "integrationConnected": true,
 *     "lastSync": "2025-06-19T10:30:00Z",
 *     "status": "healthy"
 *   },
 *   "success": true
 * }
 */
router.get('/health', calendarHealthController);

/**
 * POST /api/user-calendars/sync/outlook
 * Sincroniza calendarios de Outlook del usuario
 * 
 * Body: {} (empty - no parameters needed)
 * 
 * Response:
 * {
 *   "message": "Outlook calendars synchronized successfully",
 *   "data": [...calendars...],
 *   "syncedCount": 1,
 *   "syncedAt": "2025-06-19T10:30:00Z",
 *   "success": true
 * }
 */
router.post('/sync/outlook', syncOutlookCalendarsController);

/**
 * POST /api/user-calendars/force-sync
 * Fuerza una resincronización completa de calendarios
 * 
 * Body: {} (empty - no parameters needed)
 * 
 * Response:
 * {
 *   "message": "Calendars force resynced successfully",
 *   "data": [...calendars...],
 *   "syncedCount": 1,
 *   "syncType": "force_resync",
 *   "syncedAt": "2025-06-19T10:30:00Z",
 *   "success": true
 * }
 */
router.post('/force-sync', forceResyncCalendarsController);

export default router;