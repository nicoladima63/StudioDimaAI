// src/features/pazienti/components/RecallsStatistics.tsx
import React from "react";
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CSpinner,
} from "@coreui/react";
import { CIcon } from "@coreui/icons-react";
import {
  cilPhone,
  cilClock,
  cilWarning,
  cilCheckCircle,
  cilChart,
} from "@coreui/icons";
import RecallsSMSActionsCard from "./RecallsSMSActionsCard";

interface RecallsStatisticsProps {
  statistics: {
    totale_da_richiamare: number;
    priorita_alta: number;
    priorita_media: number;
    priorita_bassa: number;
    scaduti: number;
    in_scadenza: number;
    futuri: number;
    per_tipo: Record<string, number>;
  };
  loading: boolean;
  isSMSEnabled: boolean;
  patientsWithPhone: number;
  allWithPhoneSelected: boolean;
  selectedPatients: string[];
  handleSelectAll: () => void;
  bulkLoading: boolean;
  smsMode: boolean;
  handleBulkSMS: () => void;
}

const RecallsStatistics: React.FC<RecallsStatisticsProps> = ({
  statistics,
  loading,
  ...props
}) => {
  if (loading) {
    return (
      <div className="text-center py-3">
        <CSpinner color="primary" size="sm" />
        <span className="ms-2">Caricamento statistiche...</span>
      </div>
    );
  }

  return (
    <>
      <CRow className="mb-4 justify-content-center">
        <CCol md={2}>
          <CCard>
            <CCardBody className="d-flex align-items-center">
              <CIcon icon={cilPhone} size="xl" className="text-primary me-3" />
              <div>
                <div className="fs-5 fw-semibold text-primary">
                  {statistics.totale_da_richiamare}
                </div>
                <div className="text-muted text-uppercase fw-semibold small">
                  Totale Richiami
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={2}>
          <CCard>
            <CCardBody className="d-flex align-items-center">
              <CIcon icon={cilWarning} size="xl" className="text-danger me-3" />
              <div>
                <div className="fs-5 fw-semibold text-danger">
                  {statistics.priorita_alta}
                </div>
                <div className="text-muted text-uppercase fw-semibold small">
                  Alta Priorità
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={2}>
          <CCard>
            <CCardBody className="d-flex align-items-center">
              <CIcon icon={cilClock} size="xl" className="text-warning me-3" />
              <div>
                <div className="fs-5 fw-semibold text-warning">
                  {statistics.scaduti}
                </div>
                <div className="text-muted text-uppercase fw-semibold small">
                  Scaduti
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={3}>
          <CCard>
            <CCardBody className="d-flex align-items-center justify-content-around">
              <div className="d-flex align-items-center">
                <CIcon
                  icon={cilCheckCircle}
                  size="xl"
                  className="text-primary me-3"
                />
                <div className="text-center">
                  <div className="fs-5 fw-semibold text-primary">
                    {statistics.in_scadenza}
                  </div>
                  <div className="text-muted text-uppercase fw-semibold small">
                    Totale Pazienti
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center">
                <CIcon
                  icon={cilChart}
                  size="xl"
                  className="text-primary me-3"
                />
                <div className="text-center">
                  <div className="text-muted text-uppercase fw-semibold small">
                    <div className="fs-5 fw-semibold text-info">
                      {Object.entries(statistics.per_tipo)[0]?.[1] || 0}
                    </div>
                    <div className="text-muted text-uppercase fw-semibold small">
                      {Object.entries(statistics.per_tipo)[0]?.[0] ||
                        "Sconosciuto"}
                    </div>
                  </div>
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={3}>
          <RecallsSMSActionsCard
            isSMSEnabled={props.isSMSEnabled}
            patientsWithPhone={props.patientsWithPhone}
            allWithPhoneSelected={props.allWithPhoneSelected}
            selectedPatients={props.selectedPatients}
            handleSelectAll={props.handleSelectAll}
            bulkLoading={props.bulkLoading}
            smsMode={props.smsMode}
            handleBulkSMS={props.handleBulkSMS}
          />
        </CCol>
      </CRow>
    </>
  );
};

export default RecallsStatistics;
