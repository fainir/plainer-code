import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChatStore } from '../stores/chatStore';
import { useDriveStore } from '../stores/driveStore';
import toast from 'react-hot-toast';
import { getWsUrl } from '../api/config';

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 15000;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttempt = useRef(0);
  const isUnmounting = useRef(false);
  const [connected, setConnected] = useState(false);
  const queryClient = useQueryClient();
  // Store queryClient in ref so connect() doesn't depend on it
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const startHeartbeat = useCallback((ws: WebSocket) => {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    // Don't reconnect if already open or connecting
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const wsUrl = getWsUrl(token);
    console.log('[WS] Connecting to', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);
      reconnectAttempt.current = 0;
      startHeartbeat(ws);
    };

    ws.onerror = (e) => {
      console.error('[WS] Error', e);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Use .getState() to avoid stale closures and dependency issues
      const chatStore = useChatStore.getState();
      const qc = queryClientRef.current;

      switch (data.type) {
        case 'chat.message':
          chatStore.addMessage({
            id: data.payload.id,
            conversation_id: data.payload.conversation_id,
            sender_type: data.payload.sender_type,
            sender_id: data.payload.sender_id,
            sender_name: data.payload.sender_name,
            content: data.payload.content,
            created_at: data.payload.created_at || new Date().toISOString(),
          });
          break;

        case 'agent.stream_delta':
          chatStore.appendStreamDelta(data.payload.delta);
          break;

        case 'agent.stream_end':
          chatStore.finalizeStream(data.payload.content, data.payload.conversation_id);
          break;

        case 'agent.tool_use':
          if (data.payload.status === 'started') {
            chatStore.addToolCall({
              toolName: data.payload.tool_name as string,
              label: (data.payload.label as string) || data.payload.tool_name as string,
              status: 'started',
            });
          } else {
            chatStore.updateToolCall(
              data.payload.tool_name as string,
              (data.payload.label as string) || data.payload.tool_name as string,
              'completed',
              data.payload.result as string | undefined,
            );
          }
          break;

        case 'file.created':
        case 'file.updated':
        case 'file.deleted':
          qc.invalidateQueries({ queryKey: ['drive-files'] });
          qc.invalidateQueries({ queryKey: ['recent-files'] });
          qc.invalidateQueries({ queryKey: ['view-files'] });
          qc.invalidateQueries({ queryKey: ['favorite-files'] });
          qc.invalidateQueries({ queryKey: ['file-linked-views'] });
          qc.invalidateQueries({ queryKey: ['all-views'] });
          // Refresh file content if updated
          if (data.type === 'file.updated' && data.payload?.file_id) {
            qc.invalidateQueries({ queryKey: ['file-content', data.payload.file_id] });
          }
          // Clear selected file if it was deleted
          if (data.type === 'file.deleted' && data.payload?.file_id) {
            const { selectedFileId, clearSelectedFile } = useDriveStore.getState();
            if (selectedFileId === data.payload.file_id) {
              clearSelectedFile();
            }
          }
          break;

        case 'folder.created':
        case 'folder.updated':
        case 'folder.deleted':
          qc.invalidateQueries({ queryKey: ['drive-folders'] });
          qc.invalidateQueries({ queryKey: ['favorite-folders'] });
          break;

        case 'error':
          toast.error(data.payload.message as string);
          chatStore.setAgentTyping(false);
          break;

        case 'pong':
          // Heartbeat response — connection is alive
          break;
      }
    };

    ws.onclose = (e) => {
      console.log('[WS] Closed', e.code, e.reason);
      setConnected(false);
      wsRef.current = null;
      stopHeartbeat();

      // If agent was streaming when connection dropped, clean up the state
      const { isAgentTyping, streamingContent, finalizeStream: finalize } = useChatStore.getState();
      if (isAgentTyping) {
        if (streamingContent) {
          // Save whatever was streamed so far as a partial message
          finalize(streamingContent + '\n\n*(connection lost)*');
        } else {
          // Just reset the typing state
          useChatStore.getState().setAgentTyping(false);
        }
      }

      // Auto-reconnect unless component is unmounting or auth failure
      if (!isUnmounting.current && e.code !== 4001) {
        const delay = Math.min(
          RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempt.current),
          RECONNECT_MAX_DELAY
        );
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempt.current + 1})`);
        reconnectTimer.current = setTimeout(() => {
          reconnectAttempt.current++;
          connect();
        }, delay);
      }
    };
  }, [startHeartbeat, stopHeartbeat]);

  useEffect(() => {
    isUnmounting.current = false;
    connect();

    return () => {
      isUnmounting.current = true;
      stopHeartbeat();
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect, stopHeartbeat]);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('[WS] Not connected, readyState:', wsRef.current?.readyState);
      toast.error('Not connected to server. Reconnecting...');
    }
  }, []);

  return { send, connected };
}
