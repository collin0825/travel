import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import LoadingScreen from '@/components/LoadingScreen';
import { useAuthStore } from '@/stores';

const ProtectedRoute: React.FC = () => {
  const status = useAuthStore((state) => state.status);

  if (status === 'idle' || status === 'loading') {
    return <LoadingScreen />;
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;
