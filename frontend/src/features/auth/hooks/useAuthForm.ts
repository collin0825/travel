import { useState } from 'react';
import type { FormEvent } from 'react';
import { authApi } from '@/api';
import { useAuthStore } from '@/stores';

export type AuthMode = 'login' | 'register' | 'reset';

export const useAuthForm = () => {
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);

  const [mode, setModeState] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const setMode = (next: AuthMode) => {
    setModeState(next);
    setError('');
    setInfo('');
    setPassword('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login({ email, password, display_name: '' });
      } else if (mode === 'register') {
        await register({ email, password, display_name: displayName });
      } else {
        await authApi.resetPassword({
          email,
          display_name: displayName,
          new_password: password,
        });
        setMode('login');
        setInfo('密碼已重設，請用新密碼登入');
      }
    } catch (err) {
      setError((err as Error).message || '認證失敗，請再試一次');
    } finally {
      setLoading(false);
    }
  };

  return {
    mode,
    setMode,
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    error,
    info,
    loading,
    handleSubmit,
  };
};
