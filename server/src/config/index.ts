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

const demoMode = optionalEnv('DEMO_MODE', 'false') === 'true';

export const config = {
  demoMode,
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
    // 'groq' uses Groq's Whisper API — fast & free tier available (requires GROQ_API_KEY)
    // 'openai' uses the OpenAI Whisper API (requires OPENAI_API_KEY)
    provider: optionalEnv('WHISPER_PROVIDER', 'groq') as 'openai' | 'groq',
  },

  groq: {
    apiKey: optionalEnv('GROQ_API_KEY'),
  },

  payme: {
    apiKey: demoMode ? 'demo' : requireEnv('PAYME_API_KEY'),
    sellerKey: demoMode ? 'demo' : requireEnv('PAYME_SELLER_KEY'),
    webhookSecret: demoMode ? 'demo' : requireEnv('PAYME_WEBHOOK_SECRET'),
    applicationFeePercent: 2,
    // PayMe subscription plan ID for the $29/month InvoiceVoice subscription
    subscriptionPlanId: demoMode ? 'demo' : requireEnv('PAYME_SUBSCRIPTION_PLAN_ID'),
    trialDays: parseInt(optionalEnv('PAYME_TRIAL_DAYS', '14'), 10),
    // 'sandbox' or 'live'
    environment: optionalEnv('PAYME_ENVIRONMENT', 'sandbox') as 'sandbox' | 'live',
  },

  twilio: {
    accountSid: optionalEnv('TWILIO_ACCOUNT_SID'),
    authToken: optionalEnv('TWILIO_AUTH_TOKEN'),
    phoneNumber: optionalEnv('TWILIO_PHONE_NUMBER'),
  },

  app: {
    baseUrl: optionalEnv('APP_BASE_URL', 'http://localhost:3000'),
    clientUrl: optionalEnv('CLIENT_URL', 'http://localhost:8081'),
    // Mobile deep-link scheme — used for PayMe onboarding return URLs
    scheme: optionalEnv('APP_SCHEME', 'invoicevoice'),
  },

  upload: {
    maxFileSize: 25 * 1024 * 1024, // 25MB
    tempDir: optionalEnv('UPLOAD_TEMP_DIR', path.resolve(__dirname, '../../tmp')),
  },
} as const;

export type Config = typeof config;
