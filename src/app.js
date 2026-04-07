import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/auth.routes.js';
import { oauthImplicitCallback } from './controllers/auth.controller.js';
import profilesRoutes from './routes/profiles.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import transactionsRoutes from './routes/transactions.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import adminRoutes from './routes/admin.routes.js';
import membersRoutes from './routes/members.routes.js';
import budgetsRoutes from './routes/budgets.routes.js';
import goalsRoutes from './routes/goals.routes.js';
import debtsRoutes from './routes/debts.routes.js';
import recurringRoutes from './routes/recurring.routes.js';
import productsRoutes from './routes/products.routes.js';
import customersRoutes from './routes/customers.routes.js';
import posRoutes from './routes/pos.routes.js';
import errorHandler from './middleware/errorHandler.js';
import { startDailyReminderCron, runDailyReminder } from './jobs/dailyReminder.js';
import { startRecurringCron, processRecurringTransactions } from './jobs/recurringJobs.js';

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key', 'X-Profile-Type'],
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
      profiles:     '/api/v1/profiles',
      members:      '/api/v1/members',
      categories:   '/api/v1/categories',
      transactions: '/api/v1/transactions',
      budgets:      '/api/v1/budgets',
      goals:        '/api/v1/goals',
      debts:        '/api/v1/debts',
      recurring:    '/api/v1/recurring',
      products:     '/api/v1/products',
      customers:    '/api/v1/customers',
      pos:          '/api/v1/pos',
      dashboard:    '/api/v1/dashboard',
      reports:      '/api/v1/reports',
    },
  });
});

app.get('/auth/callback', oauthImplicitCallback);
app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/profiles',      profilesRoutes);
app.use('/api/v1/members',       membersRoutes);
app.use('/api/v1/categories',    categoriesRoutes);
app.use('/api/v1/transactions',  transactionsRoutes);
app.use('/api/v1/budgets',       budgetsRoutes);
app.use('/api/v1/goals',         goalsRoutes);
app.use('/api/v1/debts',         debtsRoutes);
app.use('/api/v1/recurring',     recurringRoutes);
app.use('/api/v1/products',      productsRoutes);
app.use('/api/v1/customers',     customersRoutes);
app.use('/api/v1/pos',           posRoutes);
app.use('/api/v1/dashboard',     dashboardRoutes);
app.use('/api/v1/reports',       reportsRoutes);
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

app.get('/api/v1/cron/recurring', async (_req, res, next) => {
  try {
    const result = await processRecurringTransactions();
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
startRecurringCron();

export default app;