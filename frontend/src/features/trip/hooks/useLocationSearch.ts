import { useRef, useState } from 'react';
import { searchPlaces } from '@/api';
import type { NominatimSuggestion } from '@/types';

const DEBOUNCE_MS = 800;

/** Debounced OpenStreetMap place autocomplete. */
export const useLocationSearch = () => {
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (query: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!query.trim()) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        setSuggestions(await searchPlaces(query));
      } catch (err) {
        console.error('Failed to fetch place suggestions:', err);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  const clearSuggestions = () => setSuggestions([]);

  return { suggestions, loading, search, clearSuggestions };
};
