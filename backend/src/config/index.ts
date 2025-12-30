// @ts-nocheck
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d'
  },

  claude: {
    apiKey: process.env.CLAUDE_API_KEY || ''
  },

  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10) // 10MB
  },

  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    mode: process.env.PAYPAL_MODE || 'sandbox', // 'sandbox' o 'live'
    webhookId: process.env.PAYPAL_WEBHOOK_ID || ''
  },

  app: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8100',
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3000'
  }
};
