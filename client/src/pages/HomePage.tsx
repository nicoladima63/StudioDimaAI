import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { getMode } from '@/api/apiClient';
import { useEnvStore } from '@/features/auth/store/useAuthStore';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const setMode = useEnvStore((state) => state.setMode);
  const setRentriMode = useEnvStore((state) => state.setRentriMode);
  const setRicettaMode = useEnvStore((state) => state.setRicettaMode);

  useEffect(() => {
    // Sincronizza le modalità con il backend
    Promise.all([
      getMode('database'),
      getMode('rentri'),
      getMode('ricetta')
    ]).then(([db, rentri, ricetta]) => {
      setMode(db as 'dev' | 'prod');
      setRentriMode(rentri as 'dev' | 'prod');
      setRicettaMode(ricetta as 'dev' | 'prod');
    });
  }, [setMode, setRentriMode, setRicettaMode]);

  useEffect(() => {
    if (token) {
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [token, navigate]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h1>Benvenuto in StudioDima</h1>
      <p>Controllo autenticazione in corso...</p>
      <div className="spinner-border text-primary mt-3" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
};

export default HomePage; 