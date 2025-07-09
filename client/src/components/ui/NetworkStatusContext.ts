import { createContext, useContext } from 'react';

export interface NetworkStatusContextProps {
  status: 'checking' | 'ok' | 'network-unreachable' | 'share-unreachable';
  message: string;
  checkNetwork: () => void;
}

export const NetworkStatusContext = createContext<NetworkStatusContextProps>({
  status: 'checking',
  message: '',
  checkNetwork: () => {},
});

export const useNetworkStatus = () => useContext(NetworkStatusContext); 