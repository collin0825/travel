import { apiClient } from './client';

export interface Place {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  place_id?: string | null;
}
export interface Flight {
  id: string;
  label: string;
  kind: 'arrival' | 'departure' | 'connection';
  origin: Place | null;
  destination: Place | null;
  departure_date?: string | null;
  arrival_date?: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  departure_timezone: string;
  arrival_timezone: string;
  airport_buffer_minutes: number;
}
export interface Stay { id: string; location: Place; first_night: number; last_night: number }
export interface DaySettings { start: Place | null; end: Place | null; start_time: string | null }
export interface ItemAssistance {
  duration_minutes: number;
  progress: 'planned' | 'done' | 'skipped';
  locked: boolean;
  appointment_time: string | null;
  ticket_status: 'unknown' | 'none' | 'required' | 'reserved' | 'purchased';
  ticket_url: string;
  ticket_deadline: string | null;
  reservation_status: 'none' | 'todo' | 'booked' | 'walk_in' | 'unavailable';
  reservation_url: string;
  reservation_phone: string;
  party_size: number | null;
  booking_notes: string;
}
export interface PlanningData {
  timezone: string | null;
  flights: Flight[];
  stays: Stay[];
  days: Record<string, DaySettings>;
  items: Record<string, ItemAssistance>;
}
export interface PlanningEnvelope { revision: number; data: PlanningData; live_maps: boolean; live_routes: boolean; day_anchors?: Record<string, { start: Place | null; end: Place | null }> }
export const emptyAssistance = (): ItemAssistance => ({ duration_minutes: 60, progress: 'planned', locked: false,
  appointment_time: null, ticket_status: 'unknown', ticket_url: '', ticket_deadline: null,
  reservation_status: 'none', reservation_url: '', reservation_phone: '', party_size: null, booking_notes: '' });
export const emptyDay = (): DaySettings => ({ start: null, end: null, start_time: null });
export const emptyPlace = (): Place => ({ name: '', address: '', latitude: null, longitude: null });
export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export const ticketLabels = { unknown: '待確認是否需票', none: '不需購票', required: '待購票', reserved: '免費但需預約', purchased: '已購票／已預約' };
export const reservationLabels = { none: '未設定', todo: '待訂位', booked: '已訂位', walk_in: '現場排隊', unavailable: '不接受訂位' };
export const progressLabels = { planned: '尚未前往', done: '已完成', skipped: '略過' };

export interface RouteLeg {
  from_name: string;
  to_name: string;
  to_item_id: number | null;
  navigation_url: string;
  seconds: number | null;
  distance_meters: number | null;
  instructions: string[];
  source: string;
  fare: { currencyCode?: string; units?: string; nanos?: number } | null;
}
export interface RoutePreview {
  signature: string;
  day_number: number;
  original_ids: number[];
  item_ids: number[];
  changed: boolean;
  start: Place | null;
  end: Place | null;
  departure_at: string | null;
  clock_basis: string;
  timezone: string;
  metric: 'distance' | 'travel_time';
  saving: number | null;
  legs: RouteLeg[];
  stops: { item_id: number; name: string; arrival_at: string | null; duration_minutes: number; fixed_time: string | null }[];
  warnings: string[];
  conflicts: string[];
  can_apply: boolean;
}
export interface PlaceResult extends Place {
  source: string;
  website?: string;
  phone?: string;
  booking_url?: string;
  maps_url?: string;
  hours?: string[];
  reservable?: boolean | null;
  cuisine?: string;
  business_status?: string;
  price_level?: string;
  distance_meters?: number | null;
  detour_meters?: number | null;
  travel_seconds?: number | null;
  detour_seconds?: number | null;
}
export interface SearchResult { places: PlaceResult[]; source: string; notice: string; checked_at: string }
export const getPlanning = async (id: number): Promise<PlanningEnvelope> =>
  (await apiClient.get(`/api/itineraries/${id}/planning`, { params: { client_timezone: localZone() } })).data;
export const savePlanning = async (id: number, revision: number, data: PlanningData): Promise<PlanningEnvelope> =>
  (await apiClient.put(`/api/itineraries/${id}/planning`, { revision, data }, { params: { client_timezone: localZone() } })).data;
export const previewRoute = async (id: number, payload: { day_number: number; optimize: boolean; mode: string; preference: string; current_location: Place | null; use_current_time: boolean; client_timezone: string }): Promise<RoutePreview> =>
  (await apiClient.post(`/api/itineraries/${id}/route-preview`, payload)).data;
export const applyRoute = async (id: number, route: RoutePreview): Promise<void> => {
  await apiClient.post(`/api/itineraries/${id}/route-apply`, { day_number: route.day_number, signature: route.signature, item_ids: route.item_ids });
};
export const searchPlanningPlaces = async (id: number, query: string, options: { center?: Place | null; next_stop?: Place | null; restaurants_only?: boolean; rank_by?: string; mode?: string } = {}): Promise<SearchResult> =>
  (await apiClient.post(`/api/itineraries/${id}/places-search`, { query, ...options })).data;
export function mapsSearch(place: Place): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address || place.name)}`;
}
export function inputDateTime(value: string | null): string {
  return value?.slice(0, 16) ?? '';
}
