// routes/debug.routes.ts (crear nuevo archivo)
import { Router } from 'express';
import { 
    debugMicrosoftCalendarsController,
    advancedOutlookDebugController,
    testPersonalOutlookController,
    verifyRefreshTokenController } from '../controllers/debug.controller';

const router = Router();

// 🚨 TEMPORAL: Solo para desarrollo
router.get('/microsoft-calendars', debugMicrosoftCalendarsController);
router.get('/outlook-advanced', advancedOutlookDebugController);
router.get('/test-personal-outlook', testPersonalOutlookController);
router.get('/verify-refresh-token', verifyRefreshTokenController);

export default router;