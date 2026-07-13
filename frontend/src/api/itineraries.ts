import { apiClient } from './client';
import type {
  CreateItineraryItemPayload,
  CreateItineraryPayload,
  ItinerarySummary,
  ItineraryItem,
  JoinItineraryPayload,
  TripDetail,
  UpdateItineraryItemPayload,
  UpdateItineraryPayload,
} from '@/types';

export const getItineraries = async (): Promise<ItinerarySummary[]> => {
  const { data } = await apiClient.get<ItinerarySummary[]>('/api/itineraries');
  return data;
};

export const getItineraryDetail = async (id: number): Promise<TripDetail> => {
  const { data } = await apiClient.get<TripDetail>(`/api/itineraries/${id}`);
  return data;
};

export const createItinerary = async (
  payload: CreateItineraryPayload,
): Promise<ItinerarySummary> => {
  const { data } = await apiClient.post<ItinerarySummary>('/api/itineraries', payload);
  return data;
};

export const joinItinerary = async (
  payload: JoinItineraryPayload,
): Promise<ItinerarySummary> => {
  const { data } = await apiClient.post<ItinerarySummary>('/api/itineraries/join', payload);
  return data;
};

export const updateItinerary = async (
  id: number,
  payload: UpdateItineraryPayload,
): Promise<ItinerarySummary> => {
  const { data } = await apiClient.put<ItinerarySummary>(`/api/itineraries/${id}`, payload);
  return data;
};

export const deleteItinerary = async (id: number): Promise<void> => {
  await apiClient.delete(`/api/itineraries/${id}`);
};

export const leaveItinerary = async (id: number): Promise<void> => {
  await apiClient.post(`/api/itineraries/${id}/leave`);
};

export const createItineraryItem = async (
  itineraryId: number,
  payload: CreateItineraryItemPayload,
): Promise<ItineraryItem> => {
  const { data } = await apiClient.post<ItineraryItem>(
    `/api/itineraries/${itineraryId}/items`,
    payload,
  );
  return data;
};

export const updateItineraryItem = async (
  itemId: number,
  payload: UpdateItineraryItemPayload,
): Promise<ItineraryItem> => {
  const { data } = await apiClient.put<ItineraryItem>(
    `/api/itineraries/items/${itemId}`,
    payload,
  );
  return data;
};

export const deleteItineraryItem = async (itemId: number): Promise<void> => {
  await apiClient.delete(`/api/itineraries/items/${itemId}`);
};
