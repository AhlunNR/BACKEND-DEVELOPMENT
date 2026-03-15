import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/auth.routes.js';
import { oauthImplicitCallback } from './controllers/auth.controller.js';
import categoriesRoutes from './routes/categories.routes.js';
import transactionsRoutes from './routes/transactions.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import adminRoutes from './routes/admin.routes.js';
import errorHandler from './middleware/errorHandler.js';
import { startDailyReminderCron, runDailyReminder } from './jobs/dailyReminder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
    },
  },
}));
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.json({
    name: 'KasFlow API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    managed_by: 'KasFlow || Capstone Project CC26-PS090',
    author: 'Backend Team',
  });
});

app.get('/api/v1', (_req, res) => {
  res.json({
    name: 'KasFlow REST API',
    version: '1.0.0',
    endpoints: {
      auth:         '/api/v1/auth',
      categories:   '/api/v1/categories',
      transactions: '/api/v1/transactions',
      dashboard:    '/api/v1/dashboard',
      reports:      '/api/v1/reports',
    },
  });
});

app.get('/auth/callback', oauthImplicitCallback);
app.use('/api/v1/auth',         authRoutes);
app.use('/api/v1/categories',   categoriesRoutes);
app.use('/api/v1/transactions', transactionsRoutes);
app.use('/api/v1/dashboard',    dashboardRoutes);
app.use('/api/v1/reports',      reportsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);

app.use('/api/v1/admin', adminRoutes);

app.get('/admin-panel', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-panel.html'));
});

app.get('/api/v1/cron/daily-reminder', async (_req, res, next) => {
  try {
    const result = await runDailyReminder();
    return res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: '404 Not Found', message: 'The requested endpoint is not found' });
});

app.use(errorHandler);

startDailyReminderCron();

export default app;