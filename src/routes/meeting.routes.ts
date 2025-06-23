import { Router } from "express";
import {
  cancelMeetingController,
  createMeetBookingForGuestController,
  getUserMeetingsController,
  // ✅ NUEVOS CONTROLLERS PARA TESTING FASE 2
  createMeetBookingForGuestV2Controller,
  testMeetingFoundationsController,
  getMeetingStrategiesController,
  testOutlookZoomIntegrationController,
  runAllOutlookZoomTestsController,
  createMeetingMigratedController
} from "../controllers/meeting.controller";
import { passportAuthenticateJwt } from "../config/passport.config";


const meetingRoutes = Router();

meetingRoutes.get("/user/all", passportAuthenticateJwt, getUserMeetingsController);
meetingRoutes.post("/public/create", createMeetBookingForGuestController);
meetingRoutes.put("/cancel/:meetingId", passportAuthenticateJwt, cancelMeetingController);

// ============================================
// ✅ NUEVAS RUTAS PARA TESTING FASE 2
// ============================================

// 🎯 Endpoint principal para probar Zoom + Outlook
meetingRoutes.post("/public/create-v2", createMeetBookingForGuestV2Controller);
// 🧪 Endpoint para ejecutar tests de fundaciones
meetingRoutes.get("/test/foundations", testMeetingFoundationsController);
// 📊 Endpoint para ver estrategias disponibles
meetingRoutes.get("/strategies", getMeetingStrategiesController);


// ============================================
// ✅ AGREGAR ESTAS RUTAS AL FINAL (después de las rutas Fase 2 existentes)
// ============================================


// 🧪 TEST ESPECÍFICO OUTLOOK + ZOOM 
meetingRoutes.get("/test/outlook-zoom", testOutlookZoomIntegrationController);
// 🚀 BATERÍA COMPLETA DE TESTS
meetingRoutes.get("/test/all", runAllOutlookZoomTestsController);
// 🔍 DEBUGGING: Crear meeting con logs detallados (opcional)
meetingRoutes.post("/debug/create", createMeetingMigratedController);


export default meetingRoutes;
