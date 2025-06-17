import { Request, Response } from 'express';
import { CalendarService } from '../services/calendar.service';
import { SyncCalendarsDto, CalendarFilterDto } from '../database/dto/calendar.dto';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

export class CalendarController {
  private calendarService: CalendarService;

  constructor() {
    this.calendarService = new CalendarService();
  }

  // GET /api/calendars - Obtener calendarios del usuario
  async getUserCalendars(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Usuario no autenticado' 
        });
        return;
      }

      // Parsear query parameters para filtros opcionales
      const filterDto = plainToClass(CalendarFilterDto, req.query);
      const errors = await validate(filterDto);

      if (errors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Parámetros de filtro inválidos',
          errors: errors.map(err => err.constraints)
        });
        return;
      }

      const calendars = await this.calendarService.getUserCalendarsService(userId, filterDto);

      res.status(200).json({
        success: true,
        data: calendars,
        message: 'Calendarios obtenidos exitosamente'
      });

    } catch (error) {
      console.error('Error al obtener calendarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      });
    }
  }

  // POST /api/calendars/sync - Sincronizar calendarios desde Google
  async syncCalendars(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Usuario no autenticado' 
        });
        return;
      }

      const syncDto = plainToClass(SyncCalendarsDto, req.body);
      const errors = await validate(syncDto);

      if (errors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Datos de sincronización inválidos',
          errors: errors.map(err => err.constraints)
        });
        return;
      }

      const result = await this.calendarService.syncUserCalendarsService(userId, syncDto);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Calendarios sincronizados exitosamente'
      });

    } catch (error) {
      console.error('Error al sincronizar calendarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error al sincronizar calendarios',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      });
    }
  }

  // GET /api/calendars/:calendarId - Obtener detalles de un calendario específico
  async getCalendarDetails(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { calendarId } = req.params;
      
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Usuario no autenticado' 
        });
        return;
      }

      if (!calendarId) {
        res.status(400).json({
          success: false,
          message: 'ID de calendario requerido'
        });
        return;
      }

      const calendar = await this.calendarService.getCalendarDetailsService(userId, calendarId);

      res.status(200).json({
        success: true,
        data: calendar,
        message: 'Detalles del calendario obtenidos exitosamente'
      });

    } catch (error) {
      console.error('Error al obtener detalles del calendario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener detalles del calendario',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      });
    }
  }
}