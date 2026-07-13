import { useEffect } from 'react';
import { useItinerariesStore } from '@/stores';

/** Loads the current user's itineraries and exposes list state. */
export const useItineraryList = () => {
  const itineraries = useItinerariesStore((state) => state.itineraries);
  const loading = useItinerariesStore((state) => state.loading);
  const error = useItinerariesStore((state) => state.error);
  const fetchItineraries = useItinerariesStore((state) => state.fetchItineraries);

  useEffect(() => {
    void fetchItineraries();
  }, [fetchItineraries]);

  return { itineraries, loading, error };
};
