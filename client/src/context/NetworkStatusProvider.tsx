import React, { useEffect, useState } from 'react';
import NetworkModal from '../components/ui/MessageModal';
import { NetworkStatusContext } from './NetworkStatusContext';
import type { ReactNode } from 'react';

export const NetworkStatusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<'checking' | 'ok' | 'network-unreachable' | 'share-unreachable'>('checking');
  const [message, setMessage] = useState('');
  const [show, setShow] = useState(false);

  const checkNetwork = async () => {
    setStatus('checking');
    setShow(true);
    setMessage('Ricerca della rete in corso...');
    try {
      const res = await fetch('/api/network/status');
      const data = await res.json();
      if (data.network === 'unreachable') {
        setStatus('network-unreachable');
        setMessage('Rete non raggiungibile. Controlla la connessione.');
        setShow(true);
      } else if (data.share === 'unreachable') {
        setStatus('share-unreachable');
        setMessage('La rete è disponibile ma non hai accesso alla cartella condivisa.');
        setShow(true);
      } else {
        setStatus('ok');
        setShow(false);
        setMessage('');
      }
    } catch {
      setStatus('network-unreachable');
      setMessage('Errore di rete.');
      setShow(true);
    }
  };

  useEffect(() => {
    checkNetwork();
    // eslint-disable-next-line
  }, []);

  return (
    <NetworkStatusContext.Provider value={{ status, message, checkNetwork }}>
      {children}
      <NetworkModal
        open={show && status !== 'ok'}
        onClose={() => setShow(false)}
        message={message}
        loading={status === 'checking'}
        link={status === 'share-unreachable' ? 'file://SERVERDIMA/Pixel/WINDENT' : undefined}
      />
    </NetworkStatusContext.Provider>
  );
}; 