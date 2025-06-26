import React, { type JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from '@/pages/dashboard/Dashboard';
import ApiTest from '@/test/ApiTest';
import NotFound from '@/pages/NotFound';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import { useAuthStore } from '@/store/authStore';

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
                <Route path="/login" element={<Login />} />
                <Route
                    path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>}
                />
                <Route
                    path="/register" element={<Register />} />
                <Route
                    path="/test/api" element={<PrivateRoute><ApiTest /></PrivateRoute>}
                />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </BrowserRouter>
    );
};

export default AppRouter;
