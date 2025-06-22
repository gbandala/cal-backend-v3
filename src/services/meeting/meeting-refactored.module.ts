
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

// Estrategias
import { ZoomOutlookCalendarStrategy } from "./strategies/zoom-outlook-calendar.strategy";

// 🚀 FUTURAS ESTRATEGIAS (Fase 3)
// import { GoogleMeetCalendarStrategy } from "./strategies/google-meet-calendar.strategy";
// import { ZoomGoogleCalendarStrategy } from "./strategies/zoom-google-calendar.strategy";
// import { TeamsOutlookCalendarStrategy } from "./strategies/teams-outlook-calendar.strategy";

// 🚀 FUTUROS PROVIDERS (Fase 3)
// import { GoogleCalendarProvider } from "./providers/calendar/google-calendar.provider";
// import { GoogleMeetProvider } from "./providers/meeting/google-meet.provider";
// import { TeamsProvider } from "./providers/meeting/teams.provider";

// ✅ EXPORTS PARA USO EN EXPRESS
export {
  // Servicios principales
  MeetingRefactoredService,
  MeetingStrategyFactory,
  
  // Providers
  ZoomMeetingProvider,
  OutlookCalendarProvider,
  
  // Estrategias
  ZoomOutlookCalendarStrategy
};

/**
 * 🎯 GUÍA DE USO EN APP.MODULE.TS
 * 
 * Para usar este módulo en tu aplicación:
 * 
 * import { MeetingRefactoredModule } from './services/meeting/meeting-refactored.module';
 * 
 * @Module({
 *   imports: [
 *     // ... otros módulos
 *     MeetingRefactoredModule,
 *   ],
 *   // ...
 * })
 * export class AppModule {}
 */

/**
 * 🔄 MIGRACIÓN GRADUAL
 * 
 * Para migrar gradualmente del servicio anterior:
 * 
 * 1. Importar MeetingRefactoredModule en paralelo
 * 2. Cambiar controllers uno por uno para usar MeetingRefactoredService
 * 3. Una vez probado, remover el módulo anterior
 * 
 * Ejemplo en controller:
 * 
 * constructor(
 *   private meetingService: MeetingRefactoredService // Nuevo
 *   // private oldMeetingService: MeetingService     // Anterior (remover después)
 * ) {}
 */