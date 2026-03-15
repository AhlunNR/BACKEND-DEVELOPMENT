import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import { getReport, exportCSV, exportPDF } from '../controllers/reports.controller.js';

const router = Router();

router.get('/', authenticate, getReport);
router.get('/export/csv', exportCSV);
router.get('/export/pdf', exportPDF);

export default router;

