
/**
 * 📦 CONFIGURACIÓN PARA MEETING SERVICE REFACTORIZADO
 * 
 * Este archivo exporta todos los providers, estrategias y servicios
 * necesarios para el nuevo sistema de meetings para usar en Express.
 */

// Servicios principales
import { MeetingRefactoredService } from "./meeting-refactored.service";
import { MeetingStrategyFactory } from "./meeting-strategy.factory";

// Providers
import { ZoomMeetingProvider } from "../../services/meeting/providers/zoom.provider";
import { OutlookCalendarProvider } from "./providers/calendar/outlook-calendar.provider";
import { GoogleCalendarProvider } from "./providers/calendar/google-calendar.provider";
import { GoogleMeetProvider } from "./providers/google-meet.provider";

// Estrategias
import { ZoomOutlookCalendarStrategy } from "./strategies/zoom-outlook-calendar.strategy";
import { ZoomGoogleCalendarStrategy } from "./strategies/zoom-google-calendar.strategy";
import { GoogleMeetCalendarStrategy } from "./strategies/google-meet-calendar.strategy";


// ✅ EXPORTS PARA USO EN EXPRESS
export {
  // Servicios principales
  MeetingRefactoredService,
  MeetingStrategyFactory,
  
  // Providers
  ZoomMeetingProvider,
  OutlookCalendarProvider,
  GoogleCalendarProvider, 
  GoogleMeetProvider,
  
  
  // Estrategias
  ZoomOutlookCalendarStrategy,
  ZoomGoogleCalendarStrategy,
  GoogleMeetCalendarStrategy
};



