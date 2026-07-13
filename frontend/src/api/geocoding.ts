import type { NominatimSuggestion } from '@/types';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** Third-party OpenStreetMap place lookup (no auth header attached). */
export const searchPlaces = async (query: string): Promise<NominatimSuggestion[]> => {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    addressdetails: '1',
  });
  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch place suggestions');
  }
  return (await response.json()) as NominatimSuggestion[];
};
