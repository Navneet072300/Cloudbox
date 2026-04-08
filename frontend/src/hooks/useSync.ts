'use client';
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000';

export function useSync() {
  const { user, deviceId } = useAuthStore();
  const queryClient = useQueryClient();
  const wsRef       = useRef<WebSocket | null>(null);
  const heartbeat   = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const retryDelay  = useRef(1000);

  useEffect(() => {
    if (!user) return;

    const connect = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const ws = new WebSocket(`${WS_URL}/sync`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryDelay.current = 1000;
        ws.send(JSON.stringify({ type: 'auth', token, deviceId }));

        heartbeat.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
          }
        }, 30_000);
      };

      ws.onmessage = ({ data }) => {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'sync:file:uploaded' || msg.type === 'sync:file:deleted') {
            queryClient.invalidateQueries({ queryKey: ['files', msg.folderId ?? null] });
            queryClient.invalidateQueries({ queryKey: ['files', null] });
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        clearInterval(heartbeat.current);
        // Exponential backoff reconnect
        setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
          connect();
        }, retryDelay.current);
      };
    };

    connect();

    return () => {
      clearInterval(heartbeat.current);
      wsRef.current?.close();
    };
  }, [user?.id]);
}
