import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AUTH_REQUIRED_EVENT } from '@/api';
import { AppRoutes } from '@/routes';
import { useAuthStore, useThemeStore } from '@/stores';

const App: React.FC = () => {
  useEffect(() => {
    // Apply persisted theme and restore any existing session on startup.
    useThemeStore.getState().applyTheme();
    void useAuthStore.getState().loadUser();

    // Reset auth state whenever the API reports an expired/invalid token.
    const handleAuthRequired = () => useAuthStore.getState().reset();
    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
};

export default App;
