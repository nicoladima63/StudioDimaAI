/**
 * AccountCard Component - MVP Phase 1
 * Card minimale per visualizzare account social (mock statici per MVP)
 */

import React from 'react';
import { CCard, CCardBody, CBadge, CButton } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCheckCircle, cilXCircle } from '@coreui/icons';
import {
  cibInstagram,
  cibFacebook,
  cibLinkedin,
  cibTiktok
} from '@coreui/icons';
import type { SocialAccount } from '../types';

interface AccountCardProps {
  account: SocialAccount;
  onConnect?: (accountId: number) => void;
  onDisconnect?: (accountId: number) => void;
}

const AccountCard: React.FC<AccountCardProps> = ({ account, onConnect, onDisconnect }) => {
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

  const handleAction = () => {
    if (account.is_connected && onDisconnect) {
      onDisconnect(account.id);
    } else if (!account.is_connected && onConnect) {
      onConnect(account.id);
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

        {/* Action Button - MVP: Disabled */}
        <CButton
          size="sm"
          color={account.is_connected ? 'danger' : 'primary'}
          variant="outline"
          disabled
          title="Disponibile in Phase 2 (OAuth)"
        >
          {account.is_connected ? 'Disconnetti' : 'Connetti'}
        </CButton>

        {/* MVP Notice */}
        <small className="text-muted mt-2" style={{ fontSize: '0.7rem' }}>
          OAuth disponibile in Phase 2
        </small>
      </CCardBody>
    </CCard>
  );
};

export default AccountCard;
