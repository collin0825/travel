import { useCallback, useEffect, useRef, useState } from 'react';
import { connectItinerarySocket, sendWsMessage } from '@/api';
import { useTripStore } from '@/stores';
import type { PresenceUser } from '@/types';

export interface TypingEvent {
  noteId: number;
  userId: number;
  label: string;
}

export interface NoteUpdateEvent {
  noteId: number;
  title: string;
  content: string | null;
}

export interface TripSocket {
  activeUsers: PresenceUser[];
  lastTyping: TypingEvent | null;
  lastNoteUpdate: NoteUpdateEvent | null;
  sendTyping: (noteId: number) => void;
}

/**
 * Single WebSocket connection per trip. Routes realtime events into the trip
 * store (data) and exposes presence/typing state for collaborative UI.
 */
export const useTripSocket = (itineraryId: number): TripSocket => {
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const [lastTyping, setLastTyping] = useState<TypingEvent | null>(null);
  const [lastNoteUpdate, setLastNoteUpdate] = useState<NoteUpdateEvent | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = connectItinerarySocket(itineraryId, (message) => {
      const store = useTripStore.getState();
      switch (message.type) {
        case 'refresh_itinerary':
        case 'refresh_notes':
          void store.fetchTrip(itineraryId);
          break;
        case 'refresh_expenses':
          void store.fetchTrip(itineraryId);
          void store.fetchDebts(itineraryId);
          break;
        case 'presence':
          setActiveUsers(message.users);
          break;
        case 'note_content_update':
          setLastNoteUpdate({
            noteId: message.note_id,
            title: message.title,
            content: message.content,
          });
          void store.fetchTrip(itineraryId);
          break;
        case 'typing':
          setLastTyping({
            noteId: message.note_id,
            userId: message.user_id,
            label: `${message.display_name} 正在編輯...`,
          });
          break;
      }
    });
    socketRef.current = socket;

    return () => {
      socket?.close();
      socketRef.current = null;
    };
  }, [itineraryId]);

  const sendTyping = useCallback((noteId: number) => {
    sendWsMessage(socketRef.current, { type: 'typing', note_id: noteId });
  }, []);

  return { activeUsers, lastTyping, lastNoteUpdate, sendTyping };
};
