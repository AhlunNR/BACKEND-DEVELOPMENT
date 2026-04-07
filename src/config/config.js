const FRONTEND_URL = "http://localhost:5173";
const API_BASE_URL = "http://localhost:3000";

const config = {
  supabase: {
    url:            process.env.SUPABASE_URL            || 'https://rclgpkwmsobfulxognkb.supabase.co',
    anonKey:        process.env.SUPABASE_ANON_KEY        || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjbGdwa3dtc29iZnVseG9nbmtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTgxMTEsImV4cCI6MjA5MDg5NDExMX0.WmLzfqhFxCzyrWARtJffOO-AyF3bqMmD4xo-gBlmQH8',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjbGdwa3dtc29iZnVseG9nbmtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTMxODExMSwiZXhwIjoyMDkwODk0MTExfQ.YTueUgh3YVgVRE6x8RxhO7aARw5Evh2vuSIaIy-M7hM',
  },
  app: {
    port:        process.env.PORT || 3000,
    frontendUrl: FRONTEND_URL || 'http://localhost:5173',
    apiBaseUrl:  API_BASE_URL  || 'http://localhost:3000',
  },
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: process.env.SMTP_USER || 'cc26.ps090@gmail.com',
    pass: process.env.SMTP_PASS || 'pjec abpb kkes jxrt',
    from: 'KasFlow <cc26.ps090@gmail.com>',
  },
};

export default config;
