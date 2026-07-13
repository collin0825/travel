import { apiClient } from './client';
import type { CreateNotePayload, Note, UpdateNotePayload } from '@/types';

export const createNote = async (
  itineraryId: number,
  payload: CreateNotePayload,
): Promise<Note> => {
  const { data } = await apiClient.post<Note>(`/api/itineraries/${itineraryId}/notes`, payload);
  return data;
};

export const updateNote = async (
  noteId: number,
  payload: UpdateNotePayload,
): Promise<Note> => {
  const { data } = await apiClient.put<Note>(`/api/itineraries/notes/${noteId}`, payload);
  return data;
};

export const deleteNote = async (noteId: number): Promise<void> => {
  await apiClient.delete(`/api/itineraries/notes/${noteId}`);
};
