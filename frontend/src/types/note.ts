export interface Note {
  id: number;
  itinerary_id: number;
  title: string;
  content: string | null;
  created_by: number | null;
  updated_at: string;
}

export interface CreateNotePayload {
  title: string;
  content: string;
}

export interface UpdateNotePayload {
  title: string;
  content: string;
}
