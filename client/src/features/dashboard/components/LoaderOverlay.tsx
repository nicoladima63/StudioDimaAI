// src/components/dashboard/LoaderOverlay.tsx
import React from 'react';
import { useDashboardLoader } from '@/store/dashboardLoaderStore';

const LoaderOverlay = () => {
  const step = useDashboardLoader((s) => s.loadingStep);

  const messageMap: Record<typeof step, string> = {
    idle: '',
    loading_appointments: 'Caricamento appuntamenti... ⏳',
    loading_stats: 'Caricamento statistiche... 📊',
    loading_fatture: 'Caricamento fatture... 💼',
    done: '',
  };

  if (step === 'done' || step === 'idle') return null;

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white bg-opacity-75 z-9999">
      <div className="text-primary fs-4 fw-medium animate__animated animate__pulse">
        {messageMap[step]}
      </div>
    </div>
  );
};

export default LoaderOverlay;
