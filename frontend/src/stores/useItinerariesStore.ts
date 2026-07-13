import { create } from 'zustand';
import { itinerariesApi } from '@/api';
import type {
  CreateItineraryPayload,
  ItinerarySummary,
  JoinItineraryPayload,
  UpdateItineraryPayload,
} from '@/types';

interface ItinerariesState {
  itineraries: ItinerarySummary[];
  loading: boolean;
  error: string | null;
  fetchItineraries: () => Promise<void>;
  createItinerary: (payload: CreateItineraryPayload) => Promise<ItinerarySummary>;
  joinItinerary: (payload: JoinItineraryPayload) => Promise<ItinerarySummary>;
  updateItinerary: (id: number, payload: UpdateItineraryPayload) => Promise<void>;
  deleteItinerary: (id: number) => Promise<void>;
  /** Leaves the trip's member list without deleting the trip for others. */
  leaveItinerary: (id: number) => Promise<void>;
}

export const useItinerariesStore = create<ItinerariesState>((set, get) => ({
  itineraries: [],
  loading: false,
  error: null,

  fetchItineraries: async () => {
    set({ loading: true, error: null });
    try {
      const itineraries = await itinerariesApi.getItineraries();
      set({ itineraries, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  createItinerary: async (payload) => {
    const created = await itinerariesApi.createItinerary(payload);
    await get().fetchItineraries();
    return created;
  },

  joinItinerary: async (payload) => {
    const joined = await itinerariesApi.joinItinerary(payload);
    await get().fetchItineraries();
    return joined;
  },

  updateItinerary: async (id, payload) => {
    await itinerariesApi.updateItinerary(id, payload);
    await get().fetchItineraries();
  },

  deleteItinerary: async (id) => {
    await itinerariesApi.deleteItinerary(id);
    await get().fetchItineraries();
  },

  leaveItinerary: async (id) => {
    await itinerariesApi.leaveItinerary(id);
    await get().fetchItineraries();
  },
}));
