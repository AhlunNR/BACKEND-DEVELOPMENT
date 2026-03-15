const FRONTEND_URL = "https://tes-fe-capstone.vercel.app";
const API_BASE_URL = "https://capstone-backend-lovat.vercel.app";

const config = {
  supabase: {
    url:            process.env.SUPABASE_URL            || 'https://pweuwnuudcpgwjiuyhyy.supabase.co',
    anonKey:        process.env.SUPABASE_ANON_KEY        || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZXV3bnV1ZGNwZ3dqaXV5aHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5OTg2ODAsImV4cCI6MjA4ODU3NDY4MH0.JDSPDRqyjYZ7fzk-LvNIhBFTCyPrN42TPGZ3fhImvYs',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZXV3bnV1ZGNwZ3dqaXV5aHl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk5ODY4MCwiZXhwIjoyMDg4NTc0NjgwfQ.6TQJXSFKjIVwPG2AD3rqgXZLwgx1ZTnsFKIBQ34k73w',
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
