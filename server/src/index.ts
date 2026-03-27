import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './config/database';
import authRoutes from './routes/auth.routes';
import invoiceRoutes from './routes/invoice.routes';
import profileRoutes from './routes/profile.routes';
import webhookRoutes from './routes/webhook.routes';
import { markOverdueInvoices } from './services/invoice.service';

const app = express();

// Security headers
app.use(helmet());

// CORS — allow mobile app (no origin header) and web client
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      // Allow configured client URL
      if (origin === config.app.clientUrl) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Webhook route — mount BEFORE rate limiter so webhooks are exempt.
// Uses raw text body for HMAC signature verification.
app.use('/api/v1/webhooks', express.text({ type: 'application/json' }), webhookRoutes);

// Rate limiting (applied after webhook route so webhooks are exempt)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// JSON body parser for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
  }
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/profile', profileRoutes);

// Global error handler
app.use(errorHandler);

// Start server
const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`InvoiceVoice server running on port ${PORT}`);
});

// Overdue invoice job — runs every 6 hours
const OVERDUE_INTERVAL_MS = 6 * 60 * 60 * 1000;
markOverdueInvoices()
  .then((count) => { if (count > 0) console.log(`Marked ${count} invoices as overdue`); })
  .catch((err) => console.error('Overdue job failed on startup:', err));

const overdueJob = setInterval(async () => {
  try {
    const count = await markOverdueInvoices();
    if (count > 0) console.log(`Marked ${count} invoices as overdue`);
  } catch (err) {
    console.error('Overdue job failed:', err);
  }
}, OVERDUE_INTERVAL_MS);

// Graceful shutdown
function shutdown() {
  console.log('Shutting down gracefully...');
  clearInterval(overdueJob);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
