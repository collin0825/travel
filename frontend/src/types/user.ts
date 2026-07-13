export interface User {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

/** Lightweight member reference embedded in itinerary payloads. */
export type Member = User;
