export interface User {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export type MemberRole = 'owner' | 'editor' | 'viewer';

/** Member reference embedded in itinerary payloads, with trip role. */
export type Member = User & {
  role: MemberRole;
  is_owner: boolean;
};
