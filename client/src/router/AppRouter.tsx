import React, { type JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/dashboard/Dashboard';
import ApiTest from '@/test/ApiTest';
import NotFound from '@/pages/NotFound';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import Calendar from '@/pages/Calendar/CalendarPage';
import RecallsPage from '@/pages/recalls/RecallsPage';
import { PazientiPage } from '@/pages/pazienti';
import { useAuthStore } from '@/store/authStore';
import SettingsPage from '@/pages/settings/SettingsPage';
import { FatturePage } from '@/pages';

// Componente per le route private
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const token = useAuthStore((state) => state.token);
  console.log("PrivateRoute token:", token);
  return token ? children : <Navigate to="/login" />;
};

const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Route pubbliche */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Route protette con Layout */}
        <Route 
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/recalls" element={<RecallsPage />} />
          <Route path="/pazienti" element={<PazientiPage />} />
          <Route path="/test/api" element={<ApiTest />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/fatture" element={<FatturePage />} />
        </Route>

        {/* Route fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
