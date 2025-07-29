// src/components/dashboard/LoaderOverlay.tsx
import { useDashboardLoader } from '@/store/dashboardLoaderStore';

const LoaderOverlay = () => {
  const message = useDashboardLoader((s) => s.loadingMessage);
  const isLoading = useDashboardLoader((s) => s.isLoading);

  if (!isLoading) return null;

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white bg-opacity-75 z-9999">
      <div className="text-primary fs-4 fw-medium animate__animated animate__pulse">
        {message || 'Caricamento...'}
      </div>
    </div>
  );
};

export default LoaderOverlay;
