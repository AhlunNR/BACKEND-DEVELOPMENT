import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import resolveProfile from '../middleware/resolveProfile.js';
import { getReport, exportCSV, exportPDF } from '../controllers/reports.controller.js';

const router = Router();
router.use(authenticate);
router.use(resolveProfile);

router.get('/',           getReport);
router.get('/export/csv', exportCSV);
router.get('/export/pdf', exportPDF);

export default router;
