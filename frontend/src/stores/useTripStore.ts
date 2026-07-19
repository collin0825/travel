import { create } from 'zustand';
import { expensesApi, itinerariesApi, notesApi } from '@/api';
import type {
  CreateExpensePayload,
  CreateItineraryItemPayload,
  CreateNotePayload,
  DayOrderPayload,
  Debt,
  Note,
  TripDetail,
  UpdateExpensePayload,
  UpdateItineraryItemPayload,
  UpdateNotePayload,
} from '@/types';

interface TripState {
  trip: TripDetail | null;
  debts: Debt[];
  loading: boolean;

  /** Full load used when opening a trip (trip detail + settlement). */
  loadTrip: (itineraryId: number) => Promise<void>;
  fetchTrip: (itineraryId: number) => Promise<void>;
  fetchDebts: (itineraryId: number) => Promise<void>;
  /** Refetches the currently loaded trip and its debts. */
  refresh: () => Promise<void>;
  clear: () => void;

  addItem: (itineraryId: number, payload: CreateItineraryItemPayload) => Promise<void>;
  updateItem: (itemId: number, payload: UpdateItineraryItemPayload) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  /** Optimistically applies the new ordering, then persists it. */
  reorderItems: (itineraryId: number, days: DayOrderPayload[]) => Promise<void>;

  setMemberRole: (userId: number, role: 'editor' | 'viewer') => Promise<void>;
  removeMember: (userId: number) => Promise<void>;

  addExpense: (itineraryId: number, payload: CreateExpensePayload) => Promise<void>;
  editExpense: (expenseId: number, payload: UpdateExpensePayload) => Promise<void>;
  removeExpense: (expenseId: number) => Promise<void>;

  addNote: (itineraryId: number, payload: CreateNotePayload) => Promise<Note>;
  /** Persists a note without triggering a full refetch (used by autosave). */
  saveNote: (noteId: number, payload: UpdateNotePayload) => Promise<void>;
  removeNote: (noteId: number) => Promise<void>;
}

export const useTripStore = create<TripState>((set, get) => ({
  trip: null,
  debts: [],
  loading: false,

  loadTrip: async (itineraryId) => {
    set({ loading: true });
    try {
      const [trip, debts] = await Promise.all([
        itinerariesApi.getItineraryDetail(itineraryId),
        expensesApi.getDebts(itineraryId),
      ]);
      set({ trip, debts, loading: false });
    } catch (err) {
      console.error('Failed to load trip:', err);
      set({ loading: false });
    }
  },

  fetchTrip: async (itineraryId) => {
    try {
      const trip = await itinerariesApi.getItineraryDetail(itineraryId);
      set({ trip });
    } catch (err) {
      console.error('Failed to refresh trip:', err);
    }
  },

  fetchDebts: async (itineraryId) => {
    try {
      const debts = await expensesApi.getDebts(itineraryId);
      set({ debts });
    } catch (err) {
      console.error('Failed to refresh debts:', err);
    }
  },

  refresh: async () => {
    const id = get().trip?.id;
    if (id === undefined) return;
    await Promise.all([get().fetchTrip(id), get().fetchDebts(id)]);
  },

  clear: () => set({ trip: null, debts: [], loading: false }),

  addItem: async (itineraryId, payload) => {
    await itinerariesApi.createItineraryItem(itineraryId, payload);
    await get().fetchTrip(itineraryId);
  },

  updateItem: async (itemId, payload) => {
    await itinerariesApi.updateItineraryItem(itemId, payload);
    const id = get().trip?.id;
    if (id !== undefined) await get().fetchTrip(id);
  },

  removeItem: async (itemId) => {
    await itinerariesApi.deleteItineraryItem(itemId);
    await get().refresh();
  },

  reorderItems: async (itineraryId, days) => {
    const positions = new Map<number, { day_number: number; sort_order: number }>();
    for (const day of days) {
      day.item_ids.forEach((itemId, index) => {
        positions.set(itemId, { day_number: day.day_number, sort_order: index });
      });
    }
    set((state) =>
      state.trip
        ? {
            trip: {
              ...state.trip,
              items: state.trip.items.map((item) => {
                const next = positions.get(item.id);
                return next ? { ...item, ...next } : item;
              }),
            },
          }
        : {},
    );
    try {
      await itinerariesApi.reorderItems(itineraryId, days);
    } catch (err) {
      console.error('Failed to reorder items:', err);
      await get().fetchTrip(itineraryId);
    }
  },

  setMemberRole: async (userId, role) => {
    const id = get().trip?.id;
    if (id === undefined) return;
    await itinerariesApi.updateMemberRole(id, userId, role);
    await get().fetchTrip(id);
  },

  removeMember: async (userId) => {
    const id = get().trip?.id;
    if (id === undefined) return;
    await itinerariesApi.removeMember(id, userId);
    await get().refresh();
  },

  addExpense: async (itineraryId, payload) => {
    await expensesApi.createExpense(itineraryId, payload);
    await get().refresh();
  },

  editExpense: async (expenseId, payload) => {
    await expensesApi.updateExpense(expenseId, payload);
    await get().refresh();
  },

  removeExpense: async (expenseId) => {
    await expensesApi.deleteExpense(expenseId);
    await get().refresh();
  },

  addNote: async (itineraryId, payload) => {
    const note = await notesApi.createNote(itineraryId, payload);
    await get().fetchTrip(itineraryId);
    return note;
  },

  saveNote: async (noteId, payload) => {
    const updated = await notesApi.updateNote(noteId, payload);
    // Reflect the saved content in the store immediately so the notes list is
    // up to date on exit, without waiting for the WebSocket echo.
    set((state) =>
      state.trip
        ? {
            trip: {
              ...state.trip,
              notes: state.trip.notes.map((note) => (note.id === noteId ? updated : note)),
            },
          }
        : {},
    );
  },

  removeNote: async (noteId) => {
    await notesApi.deleteNote(noteId);
    await get().refresh();
  },
}));
