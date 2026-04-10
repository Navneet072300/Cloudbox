import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { AuthService } from '../auth/auth.service';
import { redis } from '../../infrastructure/cache/redis';
import { consumer } from '../../infrastructure/queue/kafka';
import { logger } from '../../utils/logger';

interface DeviceConn {
  userId:   string;
  deviceId: string;
  ws:       WebSocket;
}

const authService = new AuthService();

// userId → Set of connections
const connections = new Map<string, Set<DeviceConn>>();

export async function setupSyncGateway(wss: WebSocketServer): Promise<void> {
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    let conn: DeviceConn | null = null;
    let heartbeat: ReturnType<typeof setInterval>;

    ws.on('message', async (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'auth') {
          const payload = authService.verifyAccessToken(msg.token);
          conn = { userId: payload.sub, deviceId: msg.deviceId ?? 'web', ws };

          if (!connections.has(payload.sub)) connections.set(payload.sub, new Set());
          connections.get(payload.sub)!.add(conn);

          await redis.setex(`device:online:${payload.sub}:${conn.deviceId}`, 60, '1');

          ws.send(JSON.stringify({ type: 'auth:ok' }));

          // Send missed events since last disconnect
          const missed = await redis.lrange(`missed:${payload.sub}`, 0, 499);
          missed.reverse().forEach((e) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(e);
          });
          if (missed.length) await redis.del(`missed:${payload.sub}`);

          heartbeat = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              redis.setex(`device:online:${payload.sub}:${conn!.deviceId}`, 60, '1').catch(() => {});
            }
          }, 30_000);
        }

        if (msg.type === 'heartbeat' && conn) {
          ws.send(JSON.stringify({ type: 'heartbeat:ack' }));
        }
      } catch (err: any) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
      }
    });

    ws.on('close', async () => {
      clearInterval(heartbeat);
      if (conn) {
        connections.get(conn.userId)?.delete(conn);
        await redis.del(`device:online:${conn.userId}:${conn.deviceId}`);
      }
    });

    ws.on('error', (err: Error) => logger.error({ err }, 'WebSocket error'));
  });

  // Subscribe to Kafka events and push to connected clients (non-fatal if Kafka is unavailable)
  try {
    await consumer.subscribe({ topics: ['file.uploaded', 'file.deleted'], fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;
        const event = JSON.parse(message.value.toString());
        const { userId } = event;

        const msg = JSON.stringify({ type: `sync:${topic.replace('.', ':')}`, ...event });

        const userConns = connections.get(userId);
        if (!userConns || userConns.size === 0) {
          // Store for later delivery
          await redis.lpush(`missed:${userId}`, msg);
          await redis.ltrim(`missed:${userId}`, 0, 499);
          return;
        }

        userConns.forEach((c) => {
          if (c.ws.readyState === WebSocket.OPEN) c.ws.send(msg);
        });
      },
    });

    logger.info('Sync WebSocket gateway ready');
  } catch (err) {
    logger.warn({ err }, 'Kafka consumer setup failed — real-time sync unavailable until Kafka is ready');
  }
}

export function broadcastToUser(userId: string, payload: object): void {
  const msg = JSON.stringify(payload);
  connections.get(userId)?.forEach((c) => {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(msg);
  });
}
