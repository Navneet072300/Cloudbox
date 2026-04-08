import { Request, Response, NextFunction, Router } from 'express';
import client from 'prom-client';

// ── Registry ──────────────────────────────────────────────────────────────────
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// ── Custom metrics ────────────────────────────────────────────────────────────
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const activeConnections = new client.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const uploadBytesTotal = new client.Counter({
  name: 'upload_bytes_total',
  help: 'Total bytes uploaded',
  registers: [register],
});

export const uploadFilesTotal = new client.Counter({
  name: 'upload_files_total',
  help: 'Total files uploaded',
  labelNames: ['status'],
  registers: [register],
});

export const kafkaMessagesTotal = new client.Counter({
  name: 'kafka_messages_total',
  help: 'Total Kafka messages published',
  labelNames: ['topic'],
  registers: [register],
});

// ── Middleware ────────────────────────────────────────────────────────────────
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    // Normalize route: replace UUIDs and numeric IDs to avoid cardinality explosion
    const route = req.route?.path ?? req.path.replace(/[0-9a-f-]{8,}/gi, ':id');

    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration,
    );
    httpRequestTotal.inc({ method: req.method, route, status_code: res.statusCode });
  });

  next();
}

// ── /metrics endpoint ─────────────────────────────────────────────────────────
export function metricsRouter(): Router {
  const router = Router();

  router.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  return router;
}
