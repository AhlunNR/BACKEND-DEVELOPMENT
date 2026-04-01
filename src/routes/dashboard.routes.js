import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import resolveProfile from '../middleware/resolveProfile.js';
import { getSummary, getChart, getRecentTransactions, getTopCategories } from '../controllers/dashboard.controller.js';

const router = Router();
router.use(authenticate);
router.use(resolveProfile);

router.get('/', (_req, res) => {
  res.json({
    module: 'dashboard',
    endpoints: [
      { method: 'GET', path: '/api/v1/dashboard/summary' },
      { method: 'GET', path: '/api/v1/dashboard/chart' },
      { method: 'GET', path: '/api/v1/dashboard/recent' },
      { method: 'GET', path: '/api/v1/dashboard/top-categories' },
    ],
  });
});

router.get('/summary',        getSummary);
router.get('/chart',          getChart);
router.get('/recent',         getRecentTransactions);
router.get('/top-categories', getTopCategories);

export default router;
