import { getToken } from './token';
import type { ClientWsMessage, ServerWsMessage } from '@/types';

const WS_BASE =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8000`;

/**
 * Opens a WebSocket to an itinerary's collaboration room.
 * Returns null when there is no auth token.
 */
export const connectItinerarySocket = (
  itineraryId: number,
  onMessage: (message: ServerWsMessage) => void,
  onDisconnect?: (event: CloseEvent) => void,
): WebSocket | null => {
  const token = getToken();
  if (!token) return null;

  let wsUrl = `${WS_BASE}/ws/itineraries/${itineraryId}?token=${token}`;
  // Browsers require WSS when the page is served over HTTPS.
  if (window.location.protocol === 'https:') {
    wsUrl = wsUrl.replace('ws://', 'wss://');
  }

  const socket = new WebSocket(wsUrl);

  socket.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data) as ServerWsMessage);
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  };

  socket.onclose = (event) => {
    onDisconnect?.(event);
  };

  socket.onerror = (err) => {
    console.error('WebSocket error:', err);
  };

  return socket;
};

export const sendWsMessage = (socket: WebSocket | null, message: ClientWsMessage): void => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};
