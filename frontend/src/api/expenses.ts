import { apiClient } from './client';
import type { CreateExpensePayload, Debt, Expense, UpdateExpensePayload } from '@/types';

export const getDebts = async (itineraryId: number): Promise<Debt[]> => {
  const { data } = await apiClient.get<Debt[]>(`/api/itineraries/${itineraryId}/debts`);
  return data;
};

export const createExpense = async (
  itineraryId: number,
  payload: CreateExpensePayload,
): Promise<Expense> => {
  const { data } = await apiClient.post<Expense>(
    `/api/itineraries/${itineraryId}/expenses`,
    payload,
  );
  return data;
};

export const updateExpense = async (
  expenseId: number,
  payload: UpdateExpensePayload,
): Promise<Expense> => {
  const { data } = await apiClient.put<Expense>(
    `/api/itineraries/expenses/${expenseId}`,
    payload,
  );
  return data;
};

export const deleteExpense = async (expenseId: number): Promise<void> => {
  await apiClient.delete(`/api/itineraries/expenses/${expenseId}`);
};
