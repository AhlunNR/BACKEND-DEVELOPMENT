import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import { getGlobalNotifications } from '../controllers/notifications.controller.js';

const router = Router();
router.use(authenticate);

// Global Announcement endpoint (Read-only for users)
router.get('/', getGlobalNotifications);

export default router;
