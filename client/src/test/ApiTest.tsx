import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { ping } from '@/api/apiClient';

const ApiTest: React.FC = () => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    const fetchProtectedData = async () => {
      if (!token) {
        setError('Token non trovato. Effettua il login.');
        return;
      }

      try {
        const data  = await ping(); // ping usa già il token tramite axios preconfigurato
        setMessage(data.message);
      } catch (err: unknown) {
        console.error('API test error:', err);

        if (axios.isAxiosError(err)) {
          if (
            err.response &&
            err.response.data &&
            typeof err.response.data.message === 'string'
          ) {
            setError(err.response.data.message);
          } else {
            setError('Errore nel recuperare i dati.');
          }
        } else {
          setError('Errore di connessione o di configurazione.');
        }
      }
    };

    fetchProtectedData();
  }, [token]);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Test API Protetta</h1>
      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default ApiTest;
