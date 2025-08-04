import React, { type JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

import {Layout} from '@/components/layout';
import Dashboard from '@/features/dashboard/pages/Dashboard';
import DashboardDebug from '@/features/dashboard/pages/DashboardDebug';
import ApiTest from '@/test/ApiTest';
import NotFound from '@/pages/NotFound';
import LoginPage from '@/features/auth/pages/LoginPage';
import RegisterPage from '@/features/auth/pages/RegisterPage';
import Calendar from '@/features/calendar/pages/CalendarPage';
import RecallsPage from '@/features/recalls/pages/RecallsPage';
import PazientiPage from '@/features/pazienti/pages/PazientiPage';
import SettingsPage from '@/features/settings/pages/SettingsPage';
import RentriPage from '@/features/rentri/pages/RentriPage';
import FatturePage from '@/features/fatture/pages/FatturePage';
import RicettaElettronicaPage from '@/features/ricetta-elettronica/pages/RicettaElettronicaPage';
import RicettaSettingPage from '@/features/ricetta-elettronica/pages/RicettaSettingPage';
import RicetteTestPage from '@/features/ricetta-elettronica/pages/RicetteTestPage';
import HomePage from '@/pages/HomePage';
import IncassiPage from '@/features/pki/incassi/IncassiPage';
import SpesePage from '@/features/spese';
import FornitoriPage from '@/features/fornitori/pages/FornitoriPage';
import KpiPage from '@/features/kpi/pages/KpiPage';

// Componente per le route private
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const token = useAuthStore((state) => state.token);
  return token ? children : <Navigate to="/login" />;
};

const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Route pubbliche */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/home" element={<HomePage />} />

        {/* Route protette con Layout */}
        <Route 
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/debug" element={<DashboardDebug />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/recalls" element={<RecallsPage />} />
          <Route path="/pazienti" element={<PazientiPage />} />
          <Route path="/test/api" element={<ApiTest />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/fatture" element={<FatturePage />} />
          <Route path="/ricetta" element={<RicettaElettronicaPage />} />
          <Route path="/ricetta/setting" element={<RicettaSettingPage />} />
          <Route path="/ricetta/test" element={<RicetteTestPage />} />
          <Route path="/incassi" element={<IncassiPage />} />
          <Route path="/spese" element={<SpesePage />} />
          <Route path="/fornitori" element={<FornitoriPage />} />
          <Route path="/kpi" element={<KpiPage />} />
          <Route path="/rentri" element={<RentriPage />} />
        </Route>

        {/* Route fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
