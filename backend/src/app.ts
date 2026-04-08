import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import authRoutes    from './modules/auth/auth.routes';
import filesRoutes   from './modules/files/files.routes';
import foldersRoutes from './modules/folders/folders.routes';
import sharesRoutes  from './modules/shares/shares.routes';

import { errorHandler }   from './middleware/errorHandler';
import { requestLogger }  from './middleware/requestLogger';
import { apiLimiter }     from './middleware/rateLimit';
import { metricsMiddleware, metricsRouter } from './middleware/metrics';
import { setupSyncGateway } from './modules/sync/sync.gateway';
import { connectKafka, disconnectKafka } from './infrastructure/queue/kafka';
import { redis }          from './infrastructure/cache/redis';
import { prisma }         from './infrastructure/database/prisma';
import { startHousekeepingJobs } from './jobs/housekeeping';
import { logger }         from './utils/logger';

const app        = express();
const httpServer = createServer(app);

// ─── WebSocket ────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer, path: '/sync' });

// ─── Middleware ───────────────────────────────────────────────────────
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow S3 presigned URLs
}));

app.use(cors({
  origin:      (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
}));

app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);
app.use(metricsMiddleware);
app.use('/api', apiLimiter);

// ─── Routes ───────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/files',   filesRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/shares',  sharesRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString(), uptime: process.uptime() });
});

app.use(metricsRouter());

// ─── Error handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    await connectKafka();
    await setupSyncGateway(wss);

    startHousekeepingJobs();

    const PORT = Number(process.env.PORT ?? 4000);
    httpServer.listen(PORT, () => {
      logger.info({ port: PORT }, `Server listening on :${PORT}`);
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received');

  httpServer.close(async () => {
    await disconnectKafka();
    await prisma.$disconnect();
    await redis.quit();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start();

export { app, httpServer };
