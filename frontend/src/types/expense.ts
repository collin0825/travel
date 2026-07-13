import type { User } from './user';

export interface Expense {
  id: number;
  itinerary_id: number;
  description: string;
  amount: number;
  paid_by: number;
  split_user_ids: number[];
  created_at: string;
}

export interface CreateExpensePayload {
  description: string;
  amount: number;
  paid_by: number;
  split_user_ids: number[];
}

export type UpdateExpensePayload = CreateExpensePayload;

/** Computed settlement suggestion (who pays whom). */
export interface Debt {
  from_user: User;
  to_user: User;
  amount: number;
}
