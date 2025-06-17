import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middeware";
import { HTTPSTATUS } from "../config/http.config";
import {
  getAvailabilityForPublicEventService,
  getUserAvailabilityService,
  updateAvailabilityService,
} from "../services/availability.service";
import { asyncHandlerAndValidation } from "../middlewares/withValidation.middleware";
import { UpdateAvailabilityDto } from "../database/dto/availability.dto";
import { EventIdDTO } from "../database/dto/event.dto";

// Función auxiliar para validar zonas horarias
function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (e) {
    return false;
  }
}

export const getUserAvailabilityController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;
    const timezone = req.query.timezone as string || 'UTC';

        // Validar que sea una zona horaria válida
    if (timezone && !isValidTimezone(timezone)) {
      return res.status(HTTPSTATUS.BAD_REQUEST).json({
        message: "Invalid timezone",
      });
    }
    const availability = await getUserAvailabilityService(userId,timezone);

    return res.status(HTTPSTATUS.OK).json({
      message: "Fetched availability successfully",
      availability,
    });
  }
);

export const updateAvailabilityController = asyncHandlerAndValidation(
  UpdateAvailabilityDto,
  "body",
  async (req: Request, res: Response, updateAvailabilityDto) => {
    const userId = req.user?.id as string;
        // Obtener timezone del query param, con valor por defecto UTC
    const timezone = req.query.timezone as string || 'UTC';
    
    // Validar que sea una zona horaria válida
    if (timezone && !isValidTimezone(timezone)) {
      return res.status(HTTPSTATUS.BAD_REQUEST).json({
        message: "Invalid timezone",
      });
    }

    await updateAvailabilityService(userId, updateAvailabilityDto,timezone);

    return res.status(HTTPSTATUS.OK).json({
      message: "Availability updated successfully",
    });
  }
);

// For Public Event
export const getAvailabilityForPublicEventController =
  asyncHandlerAndValidation(
    EventIdDTO,
    "params",
    async (req: Request, res: Response, eventIdDto) => {

      // Obtener timezone y date de los query params
      const timezone = req.query.timezone as string || 'UTC';
      const date = req.query.date as string ;
      
      // Validar que sea una zona horaria válida
      if (timezone && !isValidTimezone(timezone)) {
        return res.status(HTTPSTATUS.BAD_REQUEST).json({
          message: "Invalid timezone",
        });
      }
      // Validar formato de fecha si se proporciona
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(HTTPSTATUS.BAD_REQUEST).json({
          message: "Invalid date format. Use YYYY-MM-DD",
        });
      }

      const availability = await getAvailabilityForPublicEventService(
        eventIdDto.eventId,
        timezone,
        date
      );
      return res.status(HTTPSTATUS.OK).json({
        message: "Event availability fetched successfully",
        data: availability,
      });
    }
  );
