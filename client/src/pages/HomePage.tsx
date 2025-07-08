import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (token) {
        navigate('/'); // Dashboard
      } else {
        navigate('/login');
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [token, navigate]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h1>Benvenuto in StudioDima</h1>
      <p>Controllo autenticazione in corso... verrai reindirizzato tra pochi secondi.</p>
    </div>
  );
};

export default HomePage; 