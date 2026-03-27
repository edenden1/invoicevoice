import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
}

export const config = {
  port: parseInt(optionalEnv('PORT', '3000'), 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  isDev: optionalEnv('NODE_ENV', 'development') === 'development',

  database: {
    url: requireEnv('DATABASE_URL'),
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: optionalEnv('JWT_EXPIRES_IN', '24h'),
  },

  openai: {
    apiKey: optionalEnv('OPENAI_API_KEY'),
  },

  anthropic: {
    apiKey: optionalEnv('ANTHROPIC_API_KEY'),
    model: optionalEnv('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001'),
  },

  // 'anthropic' or 'openai' — which LLM to use for invoice data extraction
  llmProvider: optionalEnv('LLM_PROVIDER', 'anthropic') as 'anthropic' | 'openai',

  whisper: {
    // 'openai' uses the OpenAI Whisper API (requires OPENAI_API_KEY)
    // 'local' uses a local Whisper-compatible server (e.g. whisper.cpp, faster-whisper)
    provider: optionalEnv('WHISPER_PROVIDER', 'openai') as 'openai' | 'local',
    // URL for local Whisper server (e.g. http://localhost:8080)
    localUrl: optionalEnv('WHISPER_LOCAL_URL', 'http://localhost:8080'),
  },

  stripe: {
    secretKey: requireEnv('STRIPE_SECRET_KEY'),
    webhookSecret: requireEnv('STRIPE_WEBHOOK_SECRET'),
    applicationFeePercent: 2,
    // Recurring price for the $29/month InvoiceVoice subscription
    // Create in Stripe Dashboard → Products → Add Product → $29/month recurring
    priceId: requireEnv('STRIPE_PRICE_ID'),
    trialDays: parseInt(optionalEnv('STRIPE_TRIAL_DAYS', '14'), 10),
  },

  twilio: {
    accountSid: optionalEnv('TWILIO_ACCOUNT_SID'),
    authToken: optionalEnv('TWILIO_AUTH_TOKEN'),
    phoneNumber: optionalEnv('TWILIO_PHONE_NUMBER'),
  },

  app: {
    baseUrl: optionalEnv('APP_BASE_URL', 'http://localhost:3000'),
    clientUrl: optionalEnv('CLIENT_URL', 'http://localhost:8081'),
    // Mobile deep-link scheme — used for Stripe Connect return URLs
    scheme: optionalEnv('APP_SCHEME', 'invoicevoice'),
  },

  upload: {
    maxFileSize: 25 * 1024 * 1024, // 25MB
    tempDir: optionalEnv('UPLOAD_TEMP_DIR', path.resolve(__dirname, '../../tmp')),
  },
} as const;

export type Config = typeof config;
