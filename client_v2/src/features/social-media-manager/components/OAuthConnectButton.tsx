import React, { useState } from 'react';
import {
  CButton,
  CSpinner,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CListGroup,
  CListGroupItem,
  CBadge,
  CAlert,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilLinkAlt, cilCheckCircle } from '@coreui/icons';
import toast from 'react-hot-toast';
import socialMediaManagerService from '../services/socialMediaManager.service';
import apiClient from '@/services/api/client';
import type { ApiResponse } from '@/types';
import type { SocialAccount } from '../types';

interface Props {
  account: SocialAccount;
  onConnected?: () => void;
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  tasks?: string[];
}

const OAuthConnectButton: React.FC<Props> = ({ account, onConnected }) => {
  const [loading, setLoading] = useState(false);
  const [showPageSelector, setShowPageSelector] = useState(false);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    try {
      // Step 1: Initiate OAuth flow
      const response = await apiClient.post<ApiResponse<{ authorization_url: string; state: string }>>(
        `/social-media/accounts/${account.id}/connect`
      );

      if (response.data.success && response.data.data) {
        const { authorization_url } = response.data.data;

        // Open OAuth popup
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          authorization_url,
          'OAuth Authorization',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
          toast.error('Popup bloccato! Abilita i popup per questo sito.');
          setLoading(false);
          return;
        }

        // Poll for OAuth completion
        const pollInterval = setInterval(async () => {
          if (popup.closed) {
            clearInterval(pollInterval);
            setLoading(false);

            // Check if OAuth succeeded by fetching pages
            await fetchPages();
          }
        }, 500);
      } else {
        toast.error(response.data.error || 'Failed to initiate OAuth');
        setLoading(false);
      }
    } catch (error) {
      console.error('OAuth error:', error);
      toast.error('Failed to connect account');
      setLoading(false);
    }
  };

  const fetchPages = async () => {
    try {
      const response = await apiClient.get<ApiResponse<{ pages: FacebookPage[] }>>(
        `/social-media/accounts/${account.id}/pages`
      );

      if (response.data.success && response.data.data) {
        const { pages: fetchedPages } = response.data.data;

        if (fetchedPages.length === 0) {
          toast.error('Nessuna pagina Facebook trovata per questo account');
          return;
        }

        setPages(fetchedPages);
        setShowPageSelector(true);
        toast.success(`Trovate ${fetchedPages.length} pagine Facebook`);
      } else {
        toast.error(response.data.error || 'Failed to fetch pages');
      }
    } catch (error) {
      console.error('Fetch pages error:', error);
      toast.error('Errore recupero pagine Facebook');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPage = async () => {
    if (!selectedPageId) {
      toast.error('Seleziona una pagina');
      return;
    }

    const selectedPage = pages.find(p => p.id === selectedPageId);
    if (!selectedPage) return;

    setLoading(true);
    try {
      const response = await apiClient.post<ApiResponse<SocialAccount>>(
        `/social-media/accounts/${account.id}/select-page`,
        {
          page_id: selectedPage.id,
          page_access_token: selectedPage.access_token,
        }
      );

      if (response.data.success) {
        toast.success(`Pagina "${selectedPage.name}" configurata con successo!`);
        setShowPageSelector(false);
        onConnected?.();
      } else {
        toast.error(response.data.error || 'Failed to select page');
      }
    } catch (error) {
      console.error('Select page error:', error);
      toast.error('Errore selezione pagina');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <CButton
        color="primary"
        onClick={handleConnect}
        disabled={loading}
        className="w-100"
      >
        {loading ? (
          <>
            <CSpinner size="sm" className="me-2" />
            Connessione in corso...
          </>
        ) : (
          <>
            <CIcon icon={cilLinkAlt} className="me-2" />
            Connetti con {account.platform === 'facebook' ? 'Facebook' : 'Instagram'}
          </>
        )}
      </CButton>

      {/* Page Selector Modal */}
      <CModal
        visible={showPageSelector}
        onClose={() => setShowPageSelector(false)}
        size="lg"
      >
        <CModalHeader>
          <CModalTitle>Seleziona Pagina Facebook</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CAlert color="info" className="small mb-3">
            Seleziona la pagina dello studio per pubblicare i post.
            Il token della pagina verrà salvato automaticamente.
          </CAlert>

          <CListGroup>
            {pages.map((page) => (
              <CListGroupItem
                key={page.id}
                onClick={() => setSelectedPageId(page.id)}
                className="cursor-pointer"
                style={{ cursor: 'pointer' }}
                color={selectedPageId === page.id ? 'primary' : undefined}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1">{page.name}</h6>
                    <small className="text-muted">ID: {page.id}</small>
                    {page.category && (
                      <CBadge color="secondary" className="ms-2">
                        {page.category}
                      </CBadge>
                    )}
                  </div>
                  {selectedPageId === page.id && (
                    <CIcon icon={cilCheckCircle} size="xl" className="text-white" />
                  )}
                </div>
              </CListGroupItem>
            ))}
          </CListGroup>

          {pages.length === 0 && (
            <p className="text-muted text-center py-4">
              Nessuna pagina Facebook trovata
            </p>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            onClick={() => setShowPageSelector(false)}
          >
            Annulla
          </CButton>
          <CButton
            color="primary"
            onClick={handleSelectPage}
            disabled={!selectedPageId || loading}
          >
            {loading ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Salvataggio...
              </>
            ) : (
              'Conferma Selezione'
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  );
};

export default OAuthConnectButton;
