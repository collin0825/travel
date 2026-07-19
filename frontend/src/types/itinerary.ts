import type { Member, MemberRole } from './user';
import type { Expense } from './expense';
import type { Note } from './note';

export interface ItineraryItem {
  id: number;
  itinerary_id: number;
  day_number: number;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  time: string | null; // "HH:MM"
  transport_mode: string | null;
  transport_note: string | null;
  cost: number;
  sort_order: number;
  created_at: string;
}

/** Shape returned by GET /api/itineraries (list view). */
export interface ItinerarySummary {
  id: number;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  invite_code: string;
  created_by: number | null;
  created_at: string;
  members: Member[];
  my_role: MemberRole | null;
}

/** Shape returned by GET /api/itineraries/:id (full detail view). */
export interface TripDetail {
  id: number;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  invite_code: string;
  created_by: number | null;
  my_role: MemberRole | null;
  members: Member[];
  items: ItineraryItem[];
  expenses: Expense[];
  notes: Note[];
}

export interface CreateItineraryPayload {
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

/** Same shape as create; used by PUT /api/itineraries/:id. */
export type UpdateItineraryPayload = CreateItineraryPayload;

export interface JoinItineraryPayload {
  invite_code: string;
}

export interface CreateItineraryItemPayload {
  day_number: number;
  name: string;
  description?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  time?: string | null;
  transport_mode?: string | null;
  transport_note?: string | null;
  cost?: number;
}

/** Full item shape required by PUT /api/itineraries/items/:id. */
export interface UpdateItineraryItemPayload {
  day_number: number;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  time: string | null;
  transport_mode: string | null;
  transport_note: string | null;
  cost: number;
  sort_order: number;
}

/** One day's item ordering; used by PUT /api/itineraries/:id/items/reorder. */
export interface DayOrderPayload {
  day_number: number;
  item_ids: number[];
}

/** OpenStreetMap Nominatim search result. */
export interface NominatimSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}
