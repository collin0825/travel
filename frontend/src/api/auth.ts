import { apiClient } from './client';
import type {
  AuthToken,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  UpdateProfilePayload,
  User,
} from '@/types';

export const login = async (payload: LoginPayload): Promise<AuthToken> => {
  const { data } = await apiClient.post<AuthToken>('/api/auth/login', payload);
  return data;
};

export const register = async (payload: RegisterPayload): Promise<User> => {
  const { data } = await apiClient.post<User>('/api/auth/register', payload);
  return data;
};

export const resetPassword = async (payload: ResetPasswordPayload): Promise<void> => {
  await apiClient.post('/api/auth/reset-password', payload);
};

export const changePassword = async (payload: ChangePasswordPayload): Promise<void> => {
  await apiClient.post('/api/auth/change-password', payload);
};

export const getMe = async (): Promise<User> => {
  const { data } = await apiClient.get<User>('/api/auth/me');
  return data;
};

export const updateProfile = async (payload: UpdateProfilePayload): Promise<User> => {
  const { data } = await apiClient.put<User>('/api/auth/me', payload);
  return data;
};
