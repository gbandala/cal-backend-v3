import { Router } from 'express';
import { CalendarController } from '../controllers/calendar.controller';
import { passportAuthenticateJwt } from "../config/passport.config";
const router = Router();
const calendarController = new CalendarController();

// Rutas para gestión de calendarios
// Todas las rutas requieren autenticación

/**
 * @route GET /api/calendars
 * @desc Obtener lista de calendarios del usuario autenticado
 * @access Private
 * @query {boolean} onlyActive - Filtrar solo calendarios activos
 * @query {boolean} onlyWritable - Filtrar solo calendarios con permisos de escritura
 */
router.get(
  '/',
  passportAuthenticateJwt,
  (req, res) => calendarController.getUserCalendars(req, res)
);

/**
 * @route POST /api/calendars/sync  
 * @desc Sincronizar calendarios desde Google Calendar API
 * @access Private
 * @body {boolean} forceRefresh - Forzar actualización completa del cache
 */
router.post(
  '/sync',
  passportAuthenticateJwt,
  (req, res) => calendarController.syncCalendars(req, res)
);

/**
 * @route GET /api/calendars/:calendarId
 * @desc Obtener detalles de un calendario específico
 * @access Private
 * @param {string} calendarId - ID del calendario (primary o email)
 */
router.get(
  '/:calendarId',
  passportAuthenticateJwt,
  (req, res) => calendarController.getCalendarDetails(req, res)
);

export default router;