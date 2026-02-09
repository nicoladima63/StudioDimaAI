/**
 * SocialMediaManagerPage - MVP Phase 1
 * Dashboard principale del Social Media Manager
 */

import React, { useEffect } from 'react';
import {
  CRow,
  CCol,
  CCard,
  CCardBody
} from '@coreui/react';
import { useSocialMediaStore } from '@/store/socialMedia.store';
import AccountCard from '../components/AccountCard';

const SocialMediaManagerPage: React.FC = () => {
  const { accounts, stats, loadAccounts, loadStats } = useSocialMediaStore();

  useEffect(() => {
    loadAccounts();
    loadStats();
  }, []);

  return (
    <div className="social-media-manager">
      {/* Header */}
      <CRow className="mb-3">
        <CCol>
          <h2 className="mb-0">Social Media Dashboard</h2>
          <p className="text-muted mb-0">Panoramica delle tue attività social</p>
        </CCol>
      </CRow>

      {/* Stats Cards */}
      <CRow className="mb-4">
        <CCol xs={12} sm={6} md={3}>
          <CCard className="text-white bg-primary">
            <CCardBody>
              <div className="text-medium-emphasis small">Posts Totali</div>
              <div className="fs-4 fw-bold">{stats?.total || 0}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={12} sm={6} md={3}>
          <CCard className="text-white bg-secondary">
            <CCardBody>
              <div className="text-medium-emphasis small">Bozze</div>
              <div className="fs-4 fw-bold">{stats?.draft || 0}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={12} sm={6} md={3}>
          <CCard className="text-white bg-warning">
            <CCardBody>
              <div className="text-medium-emphasis small">Schedulati</div>
              <div className="fs-4 fw-bold">{stats?.scheduled || 0}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={12} sm={6} md={3}>
          <CCard className="text-white bg-success">
            <CCardBody>
              <div className="text-medium-emphasis small">Pubblicati</div>
              <div className="fs-4 fw-bold">{stats?.published || 0}</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Social Accounts Cards */}
      <CRow className="mb-4">
        <CCol xs={12}>
          <h5 className="mb-3">Account Social</h5>
        </CCol>
        {accounts.map((account) => (
          <CCol xs={12} sm={6} md={3} key={account.id} className="mb-3">
            <AccountCard account={account} />
          </CCol>
        ))}
      </CRow>

      {/* Quick Info */}
      <CRow>
        <CCol xs={12}>
          <CCard>
            <CCardBody>
              <h5>Benvenuto nel Social Media Manager!</h5>
              <p className="text-muted mb-0">
                Questa è la versione MVP (Phase 1). Puoi creare, modificare ed eliminare posts in modalità bozza.
                Le funzionalità di connessione social, pubblicazione automatica e AI generation saranno disponibili nelle prossime fasi.
              </p>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </div>
  );
};

export default SocialMediaManagerPage;
