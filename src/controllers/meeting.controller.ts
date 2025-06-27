import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middeware";
import { HTTPSTATUS } from "../config/http.config";
import {
  MeetingFilterEnum,
  MeetingFilterEnumType,
} from "../enums/meeting.enum";
import {
  cancelMeetingService,
  createMeetBookingForGuestService,
  getUserMeetingsService,
} from "../services/meeting.service";
import { asyncHandlerAndValidation } from "../middlewares/withValidation.middleware";
import { CreateMeetingDto, MeetingIdDTO } from "../database/dto/meeting.dto";


interface ResponseMeta {
  system: string;
  duration: string;
  timestamp: string;
  debugInfo?: {
    usedMigratedService: boolean;
    eventLocationType?: string;
    calendarAppType?: string;
    hasZoomMeetingId?: boolean;
    hasCalendarEventId?: boolean;
  };
}

export const getUserMeetingsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.id as string;

    const timezone = req.query.timezone as string || 'UTC';

    const filter =
      (req.query.filter as MeetingFilterEnumType) || MeetingFilterEnum.UPCOMING;

    const meetings = await getUserMeetingsService(userId, filter,timezone);

    return res.status(HTTPSTATUS.OK).json({
      message: "Meetings fetched successfully",
      meetings,
    });
  }
);

export const createMeetBookingForGuestController = asyncHandlerAndValidation(
  CreateMeetingDto,
  "body",
  async (req: Request, res: Response, createMeetingDto) => {
    const timezone = req.query.timezone as string || 'UTC';
    const { meetLink, meeting } = await createMeetBookingForGuestService(
      createMeetingDto,
      timezone
    );
    return res.status(HTTPSTATUS.CREATED).json({
      message: "Meeting scheduled successfully",
      data: {
        meetLink,
        meeting,
      },
    });
  }
);

export const cancelMeetingController = asyncHandlerAndValidation(
  MeetingIdDTO,
  "params",
  async (req: Request, res: Response, meetingIdDto) => {
    await cancelMeetingService(meetingIdDto.meetingId);
    return res.status(HTTPSTATUS.OK).json({
      messsage: "Meeting cancelled successfully",
    });
  }
);
