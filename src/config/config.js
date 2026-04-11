import dotenv from 'dotenv';
dotenv.config();

const config = {
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  app: {
    port: process.env.PORT || 3000,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'KasFlow <no-reply@kasflow.com>',
  },
};

export default config;
