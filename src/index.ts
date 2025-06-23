import "dotenv/config";
import "reflect-metadata";
import "./config/passport.config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { config } from "./config/app.config";
import { HTTPSTATUS } from "./config/http.config";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { asyncHandler } from "./middlewares/asyncHandler.middeware";
import { initializeDatabase } from "./database/database";
import authRoutes from "./routes/auth.routes";
import passport from "passport";
import eventRoutes from "./routes/event.routes";
import availabilityRoutes from "./routes/availability.routes";
import integrationRoutes from "./routes/integration.routes";
import meetingRoutes from "./routes/meeting.routes";
import calendarRoutes from "./routes/calendar.routes"; 
import userCalendarsRoutes from './routes/user-calendars.routes';
import debugRoutes from "./routes/debug.routes";

const app = express();
const BASE_PATH = config.BASE_PATH;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

app.use(
  cors({
    origin: config.FRONTEND_ORIGIN,
    credentials: true,
  })
);

app.get(
  "/api/health",
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    res.status(HTTPSTATUS.OK).json({
      message: "Healthy",
    });
  })
);

app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/event`, eventRoutes);
app.use(`${BASE_PATH}/availability`, availabilityRoutes);
app.use(`${BASE_PATH}/integration`, integrationRoutes);
app.use(`${BASE_PATH}/meeting`, meetingRoutes);
app.use(`${BASE_PATH}/calendars`, calendarRoutes);
app.use(`${BASE_PATH}/user-calendars`, userCalendarsRoutes);
app.use(`${BASE_PATH}/debug`, debugRoutes);

app.use(errorHandler);

app.listen(config.PORT, async () => {
  await initializeDatabase();
  console.log(`Server listening on port ${config.PORT} in ${config.NODE_ENV}`);
});
