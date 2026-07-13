import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ItineraryListPage } from '@/features/itineraries';
import { ExpensesPanel, NotesPanel, SchedulePanel, TripLayout } from '@/features/trip';
import AuthPage from './AuthPage';
import ProtectedRoute from './ProtectedRoute';

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<AuthPage />} />

    <Route element={<ProtectedRoute />}>
      <Route path="/trips" element={<ItineraryListPage />} />
      <Route path="/trips/:itineraryId" element={<TripLayout />}>
        <Route index element={<SchedulePanel />} />
        <Route path="expenses" element={<ExpensesPanel />} />
        <Route path="notes" element={<NotesPanel />} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/trips" replace />} />
  </Routes>
);

export default AppRoutes;
