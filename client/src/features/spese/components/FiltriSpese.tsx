import React from "react";
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CFormSelect,
  CFormInput,
  CButton,
  CFormLabel,
} from "@coreui/react";
import type { FiltriSpese } from "../types";
import CIcon from "@coreui/icons-react";
import { cilSearch } from "@coreui/icons";
interface FiltriSpeseProps {
  filtri: FiltriSpese;
  onFiltriChange: (filtri: FiltriSpese) => void;
  onApplicaFiltri: () => void;
  loading?: boolean;
}

const FiltriSpeseComponent: React.FC<FiltriSpeseProps> = ({
  filtri,
  onFiltriChange,
  onApplicaFiltri,
  loading = false,
}) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
  const months = [
    { value: "", label: "Tutti i mesi" },
    { value: "1", label: "Gennaio" },
    { value: "2", label: "Febbraio" },
    { value: "3", label: "Marzo" },
    { value: "4", label: "Aprile" },
    { value: "5", label: "Maggio" },
    { value: "6", label: "Giugno" },
    { value: "7", label: "Luglio" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Settembre" },
    { value: "10", label: "Ottobre" },
    { value: "11", label: "Novembre" },
    { value: "12", label: "Dicembre" },
  ];

  const handleAnnoChange = (anno: number) => {
    onFiltriChange({
      ...filtri,
      anno,
      // Reset altri filtri quando cambia l'anno
      mese: undefined,
      data_inizio: undefined,
      data_fine: undefined,
    });
  };

  const handleMeseChange = (mese: string) => {
    onFiltriChange({
      ...filtri,
      mese: mese ? parseInt(mese) : undefined,
      // Resetta range date se imposti un mese
      data_inizio: undefined,
      data_fine: undefined,
    });
  };

  const handleRangeDateChange = (
    field: "data_inizio" | "data_fine",
    value: string
  ) => {
    onFiltriChange({
      ...filtri,
      [field]: value || undefined,
      // Resetta mese se imposti range date
      mese: undefined,
    });
  };

  const handleLimitChange = (limit: string) => {
    onFiltriChange({
      ...filtri,
      limit: limit ? parseInt(limit) : undefined,
    });
  };

  return (
    <CCard className="mb-4">
      <CCardHeader>
        <h5 className="mb-0">
          <CIcon icon={cilSearch} className="me-2" />
          Filtri Ricerca
        </h5>
      </CCardHeader>
      <CCardBody>
        <CRow>
          {/* Anno */}
          <CCol md={12}className="mb-3">
            <CFormLabel>Anno</CFormLabel>
            <CFormSelect
              value={filtri.anno}
              onChange={(e) => handleAnnoChange(parseInt(e.target.value))}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          {/* Mese */}
          <CCol md={12}className="mb-3">
            <CFormLabel>Mese</CFormLabel>
            <CFormSelect
              value={filtri.mese || ""}
              onChange={(e) => handleMeseChange(e.target.value)}
              disabled={!!filtri.data_inizio || !!filtri.data_fine}
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </CFormSelect>
          </CCol>

          {/* Data Inizio */}
          <CCol md={12}>
            <CFormLabel>Data Inizio</CFormLabel>
            <CFormInput
              type="date"
              value={filtri.data_inizio || ""}
              onChange={(e) =>
                handleRangeDateChange("data_inizio", e.target.value)
              }
              disabled={!!filtri.mese}
            />
          </CCol>

          {/* Data Fine */}
          <CCol md={12}>
            <CFormLabel>Data Fine</CFormLabel>
            <CFormInput
              type="date"
              value={filtri.data_fine || ""}
              onChange={(e) =>
                handleRangeDateChange("data_fine", e.target.value)
              }
              disabled={!!filtri.mese}
            />
          </CCol>

          {/* Limit */}
          <CCol md={12}>
            <CFormLabel>Limit Records</CFormLabel>
            <CFormSelect
              value={filtri.limit || 1000}
              onChange={(e) => handleLimitChange(e.target.value)}
            >
              <option value="100">100</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
              <option value="2000">2000</option>
              <option value="">Tutti</option>
            </CFormSelect>
          </CCol>
        </CRow>

        <CRow className="mt-3">
          <CCol>
            <CButton
              color="primary"
              onClick={onApplicaFiltri}
              disabled={loading}
            >
              {loading ? "Caricamento..." : "Applica Filtri"}
            </CButton>
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>
  );
};

export default FiltriSpeseComponent;
