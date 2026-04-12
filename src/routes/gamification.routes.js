// src/routes/gamification.routes.js
import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import { getSummary, getBadges, getMissions } from '../controllers/gamification.controller.js';

const router = Router();

// Semua endpoint gamifikasi butuh auth
router.use(authenticate);

router.get('/summary',  getSummary);
router.get('/badges',   getBadges);
router.get('/missions', getMissions);

export default router;