import React, { useState } from 'react';
import {
  CButton,
  CSpinner,
  CBadge,
  CCard,
  CCardBody,
  CListGroup,
  CListGroupItem,
  CAlert,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilCheckCircle,
  cilXCircle,
  cilWarning,
  cilReload,
  cilShieldAlt,
} from '@coreui/icons';
import toast from 'react-hot-toast';
import socialMediaManagerService from '../services/socialMediaManager.service';
import type { SocialAccount } from '../types';

interface Props {
  account: SocialAccount;
  onVerified?: () => void;
}

interface VerificationResult {
  is_valid: boolean;
  is_operational: boolean;
  scopes: string[];
  account_info: Record<string, unknown>;
  error?: string;
  account_name?: string;
  platform?: string;
  token_expires_at?: string;
  is_connected?: boolean;
  expires_at_timestamp?: number;
}

interface ApiResponseWithState<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  state?: 'success' | 'warning' | 'error';
}

const AccountVerificationStatus: React.FC<Props> = ({ account, onVerified }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const response = await socialMediaManagerService.apiVerifyAccount(account.id) as ApiResponseWithState<VerificationResult>;

      if (response.state === 'success' || response.state === 'warning') {
        setResult(response.data || null);

        if (response.state === 'success') {
          toast.success(`${account.platform} account is operational!`);
        } else {
          toast(response.message || 'Token valid but API issues', {
            icon: '⚠️',
            duration: 4000,
          });
        }

        onVerified?.();
      } else {
        setResult(response.data || null);
        toast.error(response.error || 'Verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to verify account');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!result) return null;

    if (result.is_operational) {
      return (
        <CBadge color="success" className="ms-2">
          <CIcon icon={cilCheckCircle} size="sm" className="me-1" />
          Operational
        </CBadge>
      );
    }

    if (result.is_valid) {
      return (
        <CBadge color="warning" className="ms-2">
          <CIcon icon={cilWarning} size="sm" className="me-1" />
          Token Valid, API Issues
        </CBadge>
      );
    }

    return (
      <CBadge color="danger" className="ms-2">
        <CIcon icon={cilXCircle} size="sm" className="me-1" />
        Not Operational
      </CBadge>
    );
  };

  const formatExpiration = (timestamp?: number, isoString?: string) => {
    if (timestamp) {
      const date = new Date(timestamp * 1000);
      return date.toLocaleString();
    }
    if (isoString) {
      const date = new Date(isoString);
      return date.toLocaleString();
    }
    return 'N/A';
  };

  return (
    <div>
      <div className="d-flex align-items-center mb-3">
        <CButton
          color="primary"
          variant="outline"
          size="sm"
          onClick={handleVerify}
          disabled={loading || !account.is_connected}
        >
          {loading ? (
            <>
              <CSpinner size="sm" className="me-2" />
              Verifying...
            </>
          ) : (
            <>
              <CIcon icon={cilReload} size="sm" className="me-2" />
              Verify Connection
            </>
          )}
        </CButton>
        {getStatusBadge()}
      </div>

      {!account.is_connected && (
        <CAlert color="warning" className="small">
          Account must be connected before verification
        </CAlert>
      )}

      {result && (
        <CCard className="border-0 shadow-sm">
          <CCardBody>
            <h6 className="mb-3">
              <CIcon icon={cilShieldAlt} className="me-2" />
              Verification Results
            </h6>

            <CListGroup flush>
              <CListGroupItem className="d-flex justify-content-between align-items-center px-0">
                <span className="text-muted">Token Valid:</span>
                <CBadge color={result.is_valid ? 'success' : 'danger'}>
                  {result.is_valid ? 'Yes' : 'No'}
                </CBadge>
              </CListGroupItem>

              <CListGroupItem className="d-flex justify-content-between align-items-center px-0">
                <span className="text-muted">API Operational:</span>
                <CBadge color={result.is_operational ? 'success' : 'danger'}>
                  {result.is_operational ? 'Yes' : 'No'}
                </CBadge>
              </CListGroupItem>

              {result.token_expires_at && (
                <CListGroupItem className="d-flex justify-content-between align-items-center px-0">
                  <span className="text-muted">Token Expires:</span>
                  <span className="small">
                    {formatExpiration(result.expires_at_timestamp, result.token_expires_at)}
                  </span>
                </CListGroupItem>
              )}

              {result.scopes && result.scopes.length > 0 && (
                <CListGroupItem className="px-0">
                  <div className="text-muted mb-2">Permissions:</div>
                  <div className="d-flex flex-wrap gap-1">
                    {result.scopes.map((scope) => (
                      <CBadge key={scope} color="info" className="small">
                        {scope}
                      </CBadge>
                    ))}
                  </div>
                </CListGroupItem>
              )}

              {result.account_info && Object.keys(result.account_info).length > 0 && (
                <CListGroupItem className="px-0">
                  <div className="text-muted mb-2">Account Info:</div>
                  <pre className="small mb-0 p-2 bg-light rounded">
                    {JSON.stringify(result.account_info, null, 2)}
                  </pre>
                </CListGroupItem>
              )}

              {result.error && (
                <CListGroupItem className="px-0">
                  <CAlert color="danger" className="small mb-0">
                    <strong>Error:</strong> {result.error}
                  </CAlert>
                </CListGroupItem>
              )}
            </CListGroup>
          </CCardBody>
        </CCard>
      )}
    </div>
  );
};

export default AccountVerificationStatus;
