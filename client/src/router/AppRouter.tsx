import React, { type JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

import {Layout} from '@/components/layout';
import Dashboard from '@/features/dashboard/pages/Dashboard';
import ApiTest from '@/test/ApiTest';
import NotFound from '@/pages/NotFound';
import LoginPage from '@/features/auth/pages/LoginPage';
import RegisterPage from '@/features/auth/pages/RegisterPage';
import Calendar from '@/features/calendar/pages/CalendarPage';
import RecallsPage from '@/features/recalls/pages/RecallsPage';
import PazientiPage from '@/features/pazienti/pages/PazientiPage';
import SettingsPage from '@/features/settings/pages/SettingsPage';
import FatturePage from '@/features/fatture/pages/FatturePage';
import RicettaElettronicaPage from '@/features/ricetta-elettronica/pages/RicettaElettronicaPage';
import HomePage from '@/pages/HomePage';

// Componente per le route private
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const token = useAuthStore((state) => state.token);
  //console.log("PrivateRoute token:", token);
  return token ? children : <Navigate to="/login" />;
};

const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Route pubbliche */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Route protette con Layout */}
        <Route 
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/recalls" element={<RecallsPage />} />
          <Route path="/pazienti" element={<PazientiPage />} />
          <Route path="/test/api" element={<ApiTest />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/fatture" element={<FatturePage />} />
          <Route path="/ricetta" element={<RicettaElettronicaPage />} />
          <Route path="/incassi" element={<IncassiPage />} />
        </Route>

        {/* Route fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
