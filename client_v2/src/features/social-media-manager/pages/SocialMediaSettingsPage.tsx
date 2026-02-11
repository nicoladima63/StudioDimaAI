/**
 * SocialMediaSettingsPage - MVP Phase 1
 * Pagina per configurare i dati di connessione ai social media
 */

import React, { useEffect, useState } from 'react';
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CButton,
  CSpinner,
  CAccordion,
  CAccordionItem,
  CAccordionHeader,
  CAccordionBody,
  CBadge
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSave, cilCheckCircle, cilXCircle } from '@coreui/icons';
import { useSocialMediaStore } from '@/store/socialMedia.store';
import toast from 'react-hot-toast';
import type { SocialAccount } from '../types';
import LogoUploader from '../components/LogoUploader';
import AccountVerificationStatus from '../components/AccountVerificationStatus';
import OAuthConnectButton from '../components/OAuthConnectButton';

const SocialMediaSettingsPage: React.FC = () => {
  const { accounts, loadAccounts, updateAccount, isLoading } = useSocialMediaStore();
  const [editingAccounts, setEditingAccounts] = useState<Record<string, Partial<SocialAccount>>>({});
  const [savingAccounts, setSavingAccounts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadAccounts();
  }, []);

  // Initialize editing state with existing account data
  useEffect(() => {
    if (accounts.length > 0) {
      const initialState: Record<string, Partial<SocialAccount>> = {};
      accounts.forEach(account => {
        initialState[account.platform] = {
          account_name: account.account_name || '',
          account_username: account.account_username || '',
          access_token: account.access_token || '',
          refresh_token: account.refresh_token || '',
          token_expires_at: account.token_expires_at || '',
          logo_url: account.logo_url || ''
        };
      });
      setEditingAccounts(initialState);
    }
  }, [accounts]);

  const handleInputChange = (platform: string, field: keyof SocialAccount, value: string) => {
    setEditingAccounts(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value
      }
    }));
  };

  const handleSaveAccount = async (account: SocialAccount) => {
    const editedData = editingAccounts[account.platform];
    if (!editedData) return;

    // Validation
    if (!editedData.account_name?.trim()) {
      toast.error(`Nome account ${account.platform} obbligatorio`);
      return;
    }

    setSavingAccounts(prev => ({ ...prev, [account.platform]: true }));

    try {
      await updateAccount(account.id, {
        account_name: editedData.account_name,
        account_username: editedData.account_username,
        access_token: editedData.access_token,
        refresh_token: editedData.refresh_token,
        token_expires_at: editedData.token_expires_at,
        logo_url: editedData.logo_url,
        is_connected: !!(editedData.access_token?.trim()) // Auto-set connected if token exists
      });

      toast.success(`Account ${account.platform} aggiornato con successo`);
    } catch (error: any) {
      toast.error(error.message || `Errore aggiornamento ${account.platform}`);
    } finally {
      setSavingAccounts(prev => ({ ...prev, [account.platform]: false }));
    }
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      instagram: 'danger',
      facebook: 'primary',
      linkedin: 'info',
      tiktok: 'dark'
    };
    return colors[platform] || 'secondary';
  };

  const getPlatformIcon = (isConnected: boolean) => {
    return isConnected ? cilCheckCircle : cilXCircle;
  };

  if (isLoading && accounts.length === 0) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <p className="mt-2 text-muted">Caricamento accounts...</p>
      </div>
    );
  }

  return (
    <div className="social-media-settings">
      {/* Header */}
      <CRow className="mb-3">
        <CCol>
          <h2 className="mb-0">Configurazione Social Media</h2>
          <p className="text-muted mb-0">
            Configura i dati di accesso per le piattaforme social
          </p>
        </CCol>
      </CRow>

      {/* Info Card MVP */}
      <CRow className="mb-4">
        <CCol>
          <CCard className="border-warning">
            <CCardBody>
              <h6 className="text-warning mb-2">MVP Phase 1 - Configurazione Manuale</h6>
              <p className="mb-0 small">
                In questa versione MVP, i dati devono essere inseriti manualmente.
                L'integrazione OAuth2 automatica sarà disponibile nella Phase 2.
              </p>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Accounts Configuration Accordion */}
      <CRow>
        <CCol>
          <CAccordion activeItemKey={accounts.length > 0 ? accounts[0].id : undefined}>
            {accounts.map(account => {
              const editedData = editingAccounts[account.platform] || {};
              const isSaving = savingAccounts[account.platform] || false;

              return (
                <CAccordionItem key={account.id} itemKey={account.id}>
                  <CAccordionHeader>
                    <div className="d-flex align-items-center w-100 justify-content-between">
                      <div className="d-flex align-items-center">
                        <CBadge
                          color={getPlatformColor(account.platform)}
                          className="me-2 text-capitalize"
                        >
                          {account.platform}
                        </CBadge>
                        <span>{account.account_name || `Account ${account.platform}`}</span>
                      </div>
                      <div className="me-3">
                        <CIcon
                          icon={getPlatformIcon(account.is_connected)}
                          className={account.is_connected ? 'text-success' : 'text-danger'}
                        />
                        <span className={`ms-2 small ${account.is_connected ? 'text-success' : 'text-danger'}`}>
                          {account.is_connected ? 'Connesso' : 'Disconnesso'}
                        </span>
                      </div>
                    </div>
                  </CAccordionHeader>
                  <CAccordionBody>
                    <CForm>
                      {/* Logo Uploader */}
                      <LogoUploader
                        currentLogoUrl={editedData.logo_url}
                        accountId={account.id}
                        accountName={account.account_name}
                        onLogoChange={async (logoUrl) => {
                          // Update local state first
                          handleInputChange(account.platform, 'logo_url', logoUrl || '');

                          // Auto-save logo immediately to database
                          try {
                            await updateAccount(account.id, { logo_url: logoUrl });
                            // Logo already saved, no need for extra toast
                          } catch (error: any) {
                            toast.error('Errore salvataggio logo');
                          }
                        }}
                      />

                      {/* Account Name */}
                      <div className="mb-3">
                        <CFormLabel htmlFor={`${account.platform}-name`}>
                          Nome Account *
                        </CFormLabel>
                        <CFormInput
                          type="text"
                          id={`${account.platform}-name`}
                          value={editedData.account_name || ''}
                          onChange={(e) => handleInputChange(account.platform, 'account_name', e.target.value)}
                          placeholder="es: Studio Dentistico Dima"
                        />
                      </div>

                      {/* Account Username */}
                      <div className="mb-3">
                        <CFormLabel htmlFor={`${account.platform}-username`}>
                          Username
                        </CFormLabel>
                        <CFormInput
                          type="text"
                          id={`${account.platform}-username`}
                          value={editedData.account_username || ''}
                          onChange={(e) => handleInputChange(account.platform, 'account_username', e.target.value)}
                          placeholder={`@username_${account.platform}`}
                        />
                      </div>

                      {/* OAuth Connect Button */}
                      <div className="mb-4">
                        <CFormLabel>Connessione Automatica (Raccomandato)</CFormLabel>
                        <OAuthConnectButton
                          account={account}
                          onConnected={() => {
                            loadAccounts();
                            toast.success('Account connesso! Verifica la connessione sotto.');
                          }}
                        />
                        <small className="text-muted d-block mt-2">
                          Autorizza con {account.platform === 'facebook' ? 'Facebook' : 'Instagram'} e
                          seleziona la tua pagina. Il token verrà configurato automaticamente.
                        </small>
                      </div>

                      {/* Manual Token Entry (Alternative) */}
                      <div className="mb-3">
                        <CFormLabel htmlFor={`${account.platform}-token`}>
                          Access Token (Configurazione Manuale)
                        </CFormLabel>
                        <CFormTextarea
                          id={`${account.platform}-token`}
                          rows={3}
                          value={editedData.access_token || ''}
                          onChange={(e) => handleInputChange(account.platform, 'access_token', e.target.value)}
                          placeholder="Oppure inserisci manualmente il Page Access Token"
                          disabled={true}
                        />
                        <small className="text-muted">
                          Token configurato automaticamente tramite OAuth. Non modificare manualmente.
                        </small>
                      </div>

                      {/* Refresh Token */}
                      <div className="mb-3">
                        <CFormLabel htmlFor={`${account.platform}-refresh`}>
                          Refresh Token (opzionale)
                        </CFormLabel>
                        <CFormTextarea
                          id={`${account.platform}-refresh`}
                          rows={2}
                          value={editedData.refresh_token || ''}
                          onChange={(e) => handleInputChange(account.platform, 'refresh_token', e.target.value)}
                          placeholder="Token per il rinnovo automatico"
                        />
                      </div>

                      {/* Token Expires At */}
                      <div className="mb-3">
                        <CFormLabel htmlFor={`${account.platform}-expires`}>
                          Scadenza Token
                        </CFormLabel>
                        <CFormInput
                          type="datetime-local"
                          id={`${account.platform}-expires`}
                          value={editedData.token_expires_at ?
                            new Date(editedData.token_expires_at).toISOString().slice(0, 16) : ''}
                          onChange={(e) => handleInputChange(account.platform, 'token_expires_at', e.target.value)}
                        />
                      </div>

                      {/* Save Button */}
                      <div className="d-flex justify-content-end mb-4">
                        <CButton
                          color="primary"
                          onClick={() => handleSaveAccount(account)}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <>
                              <CSpinner size="sm" className="me-2" />
                              Salvataggio...
                            </>
                          ) : (
                            <>
                              <CIcon icon={cilSave} className="me-2" />
                              Salva Configurazione
                            </>
                          )}
                        </CButton>
                      </div>

                      {/* Account Verification Section */}
                      {account.is_connected && (
                        <div className="mt-4 pt-4 border-top">
                          <h6 className="mb-3">Verifica Connessione</h6>
                          <AccountVerificationStatus
                            account={account}
                            onVerified={() => {
                              // Reload accounts after successful verification
                              loadAccounts();
                            }}
                          />
                        </div>
                      )}
                    </CForm>
                  </CAccordionBody>
                </CAccordionItem>
              );
            })}
          </CAccordion>
        </CCol>
      </CRow>
    </div>
  );
};

export default SocialMediaSettingsPage;
