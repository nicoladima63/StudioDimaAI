// src/test/ApiTest.tsx
import React, { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { ping } from '@/api/apiClient';

const ApiTest: React.FC = () => {
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    const fetchProtectedData = async () => {
      if (!token) {
        setError('Token non trovato. Effettua il login.');
        return;
      }

      setIsLoading(true);
      setError('');
      setMessage('');

      try {
        const data = await ping();
        setMessage(data.message || 'Connessione API riuscita!');
      } catch (err: unknown) {
        handleApiError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProtectedData();
  }, [token]);

  const handleApiError = (err: unknown) => {
    console.error('API test error:', err);

    if (axios.isAxiosError(err)) {
      const axiosError = err as AxiosError<{ message?: string }>;
      const errorMessage = axiosError.response?.data?.message 
        || axiosError.message 
        || 'Errore nel recuperare i dati';
      setError(errorMessage);
    } else if (err instanceof Error) {
      setError(err.message || 'Errore di connessione o di configurazione');
    } else {
      setError('Errore sconosciuto durante la chiamata API');
    }
  };

  return (
    <div className="api-test-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 className="api-test-title">Test API Protetta</h1>
      
      {isLoading && (
        <div className="loading-indicator">Caricamento in corso...</div>
      )}

      <div className="api-test-results">
        {message && (
          <p className="api-test-success" style={{ color: 'green' }}>
            ✅ {message}
          </p>
        )}
        {error && (
          <p className="api-test-error" style={{ color: 'red' }}>
            ❌ {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default React.memo(ApiTest);
