import React from 'react';
import { Navigate } from 'react-router-dom';
import LoadingScreen from '@/components/LoadingScreen';
import { AuthForm } from '@/features/auth';
import { useAuthStore } from '@/stores';

const AuthPage: React.FC = () => {
  const status = useAuthStore((state) => state.status);

  if (status === 'idle' || status === 'loading') {
    return <LoadingScreen />;
  }
  if (status === 'authenticated') {
    return <Navigate to="/trips" replace />;
  }
  return <AuthForm />;
};

export default AuthPage;
