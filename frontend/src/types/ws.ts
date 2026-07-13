export interface PresenceUser {
  id: number;
  display_name: string;
  avatar_url: string;
}

/** Messages broadcast by the backend over the itinerary WebSocket room. */
export type ServerWsMessage =
  | { type: 'refresh_itinerary' }
  | { type: 'refresh_expenses' }
  | { type: 'refresh_notes' }
  | { type: 'presence'; users: PresenceUser[] }
  | { type: 'note_content_update'; note_id: number; title: string; content: string | null }
  | { type: 'typing'; note_id: number; user_id: number; display_name: string };

/** Messages the client sends to the room. */
export type ClientWsMessage = { type: 'typing'; note_id: number };
