import { useOutletContext } from 'react-router-dom';
import type { TripSocket } from './hooks/useTripSocket';

export interface TripOutletContext extends TripSocket {
  itineraryId: number;
}

export const useTripContext = (): TripOutletContext => useOutletContext<TripOutletContext>();
