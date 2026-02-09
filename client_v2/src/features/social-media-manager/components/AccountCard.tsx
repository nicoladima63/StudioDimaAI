/**
 * AccountCard Component - Phase 2
 * Card per visualizzare e connettere account social con OAuth
 */

import React, { useState } from 'react';
import { CCard, CCardBody, CBadge, CButton, CSpinner } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCheckCircle, cilXCircle } from '@coreui/icons';
import {
  cibInstagram,
  cibFacebook,
  cibLinkedin,
  cibTiktok
} from '@coreui/icons';
import toast from 'react-hot-toast';
import apiClient from '@/services/api/client';
import { useSocialMediaStore } from '@/store/socialMedia.store';
import type { SocialAccount } from '../types';

interface AccountCardProps {
  account: SocialAccount;
}

const AccountCard: React.FC<AccountCardProps> = ({ account }) => {
  const { loadAccounts } = useSocialMediaStore();
  const [isConnecting, setIsConnecting] = useState(false);
  // Icon mapping per piattaforma
  const getPlatformIcon = () => {
    switch (account.platform) {
      case 'instagram':
        return cibInstagram;
      case 'facebook':
        return cibFacebook;
      case 'linkedin':
        return cibLinkedin;
      case 'tiktok':
        return cibTiktok;
      default:
        return null;
    }
  };

  // Colore per piattaforma
  const getPlatformColor = () => {
    switch (account.platform) {
      case 'instagram':
        return '#E1306C';
      case 'facebook':
        return '#1877F2';
      case 'linkedin':
        return '#0A66C2';
      case 'tiktok':
        return '#000000';
      default:
        return '#666666';
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Initiate OAuth flow
      const response = await apiClient.post(
        `/social-media/accounts/${account.id}/connect`
      );

      const { authorization_url } = response.data.data;

      // Open OAuth popup
      const popup = window.open(
        authorization_url,
        'oauth_popup',
        'width=600,height=700,scrollbars=yes'
      );

      if (!popup) {
        toast.error('Popup bloccato! Abilita i popup per questo sito.');
        setIsConnecting(false);
        return;
      }

      // Listen for OAuth callback (popup closes)
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          // Reload accounts to get updated connection status
          setTimeout(() => {
            // Invalidate cache first to force fresh data fetch
            useSocialMediaStore.getState().invalidateCache('accounts');
            loadAccounts();
            setIsConnecting(false);
          }, 500);
        }
      }, 1000);

    } catch (error: any) {
      console.error('OAuth connection error:', error);
      toast.error(error.response?.data?.error || 'Errore durante la connessione');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(`Disconnettere ${account.account_name}?`)) {
      return;
    }

    try {
      await apiClient.post(`/social-media/accounts/${account.id}/disconnect`);
      toast.success('Account disconnesso con successo');
      // Invalidate cache first to force fresh data fetch
      useSocialMediaStore.getState().invalidateCache('accounts');
      loadAccounts();
    } catch (error: any) {
      console.error('Disconnect error:', error);
      toast.error(error.response?.data?.error || 'Errore durante la disconnessione');
    }
  };

  const handleAction = () => {
    if (account.is_connected) {
      handleDisconnect();
    } else {
      handleConnect();
    }
  };

  return (
    <CCard style={{ height: '100%', minHeight: '200px' }}>
      <CCardBody className="d-flex flex-column align-items-center justify-content-center text-center p-3">
        {/* Icon Piattaforma */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: `${getPlatformColor()}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}
        >
          {getPlatformIcon() && (
            <CIcon
              icon={getPlatformIcon()!}
              size="xl"
              style={{ color: getPlatformColor() }}
            />
          )}
        </div>

        {/* Account Name */}
        <h6 className="mb-1">{account.account_name}</h6>
        {account.account_username && (
          <small className="text-muted mb-2">{account.account_username}</small>
        )}

        {/* Status Badge */}
        <div className="mb-3">
          {account.is_connected ? (
            <CBadge color="success" className="d-flex align-items-center gap-1">
              <CIcon icon={cilCheckCircle} size="sm" />
              Connesso
            </CBadge>
          ) : (
            <CBadge color="secondary" className="d-flex align-items-center gap-1">
              <CIcon icon={cilXCircle} size="sm" />
              Disconnesso
            </CBadge>
          )}
        </div>

        {/* Action Button */}
        <CButton
          size="sm"
          color={account.is_connected ? 'danger' : 'primary'}
          variant="outline"
          onClick={handleAction}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <CSpinner size="sm" className="me-2" />
              Connessione...
            </>
          ) : (
            account.is_connected ? 'Disconnetti' : 'Connetti'
          )}
        </CButton>

        {/* Last synced info */}
        {account.is_connected && account.last_synced_at && (
          <small className="text-muted mt-2" style={{ fontSize: '0.7rem' }}>
            Ultimo sync: {new Date(account.last_synced_at).toLocaleString('it-IT')}
          </small>
        )}
      </CCardBody>
    </CCard>
  );
};

export default AccountCard;
