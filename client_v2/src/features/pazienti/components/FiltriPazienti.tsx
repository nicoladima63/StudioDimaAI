import React from 'react';
import {
  CCard,
  CCardBody,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CRow,
} from '@coreui/react';
import type { Paziente } from '@/store/pazienti.store';

export type EtaTipo = 'qualsiasi' | 'fino_a' | 'da' | 'tra';

export interface FiltriState {
  sesso: '' | 'M' | 'F';
  comune: string;
  etaTipo: EtaTipo;
  etaMin: number | '';
  etaMax: number | '';
  soloCellulare: boolean;
}

export const FILTRI_DEFAULT: FiltriState = {
  sesso: '',
  comune: '',
  etaTipo: 'qualsiasi',
  etaMin: '',
  etaMax: '',
  soloCellulare: true,
};

export function calcolaEta(dataNascita?: string): number | null {
  if (!dataNascita) return null;
  const birth = new Date(dataNascita);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  return Math.floor((today.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export function applicaFiltri(pazienti: Paziente[], filtri: FiltriState): Paziente[] {
  return pazienti.filter((p) => {
    if (filtri.sesso && (p.sesso || '').toUpperCase() !== filtri.sesso) return false;
    if (filtri.comune.trim()) {
      const citta = (p.citta || '').toLowerCase();
      if (!citta.includes(filtri.comune.toLowerCase().trim())) return false;
    }
    if (filtri.soloCellulare && !p.cellulare) return false;
    if (filtri.etaTipo !== 'qualsiasi') {
      const eta = calcolaEta(p.data_nascita);
      if (eta === null) return false;
      if (filtri.etaTipo === 'fino_a' && filtri.etaMax !== '' && eta > filtri.etaMax) return false;
      if (filtri.etaTipo === 'da' && filtri.etaMin !== '' && eta < filtri.etaMin) return false;
      if (filtri.etaTipo === 'tra') {
        if (filtri.etaMin !== '' && eta < filtri.etaMin) return false;
        if (filtri.etaMax !== '' && eta > filtri.etaMax) return false;
      }
    }
    return true;
  });
}

interface FiltriPazientiProps {
  filtri: FiltriState;
  onChange: (f: FiltriState) => void;
  totale: number;
  filtrati: number;
  conCellulare: number;
}

const FiltriPazienti: React.FC<FiltriPazientiProps> = ({
  filtri,
  onChange,
  totale,
  filtrati,
  conCellulare,
}) => {
  const set = (partial: Partial<FiltriState>) => onChange({ ...filtri, ...partial });

  return (
    <CCard className="mb-3">
      <CCardBody>
        <CRow className="g-3 align-items-end">

          <CCol md={2}>
            <CFormLabel className="fw-semibold">Sesso</CFormLabel>
            <CFormSelect value={filtri.sesso} onChange={(e) => set({ sesso: e.target.value as FiltriState['sesso'] })}>
              <option value="">Tutti</option>
              <option value="M">Solo maschi</option>
              <option value="F">Solo femmine</option>
            </CFormSelect>
          </CCol>

          <CCol md={2}>
            <CFormLabel className="fw-semibold">Comune</CFormLabel>
            <CFormInput
              placeholder="Es. Firenze"
              value={filtri.comune}
              onChange={(e) => set({ comune: e.target.value })}
            />
          </CCol>

          <CCol md={2}>
            <CFormLabel className="fw-semibold">Filtro eta</CFormLabel>
            <CFormSelect
              value={filtri.etaTipo}
              onChange={(e) => set({ etaTipo: e.target.value as EtaTipo, etaMin: '', etaMax: '' })}
            >
              <option value="qualsiasi">Qualsiasi</option>
              <option value="fino_a">Fino a</option>
              <option value="da">Da</option>
              <option value="tra">Tra</option>
            </CFormSelect>
          </CCol>

          {(filtri.etaTipo === 'da' || filtri.etaTipo === 'tra') && (
            <CCol md={1}>
              <CFormLabel className="fw-semibold">{filtri.etaTipo === 'tra' ? 'Da' : 'Anni min'}</CFormLabel>
              <CFormInput
                type="number"
                min={0}
                max={120}
                placeholder="es. 20"
                value={filtri.etaMin}
                onChange={(e) => set({ etaMin: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </CCol>
          )}

          {(filtri.etaTipo === 'fino_a' || filtri.etaTipo === 'tra') && (
            <CCol md={1}>
              <CFormLabel className="fw-semibold">{filtri.etaTipo === 'tra' ? 'A' : 'Anni max'}</CFormLabel>
              <CFormInput
                type="number"
                min={0}
                max={120}
                placeholder="es. 50"
                value={filtri.etaMax}
                onChange={(e) => set({ etaMax: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </CCol>
          )}

          <CCol md={2} className="d-flex align-items-end pb-1">
            <CFormCheck
              id="solo-cellulare"
              label="Solo con cellulare"
              checked={filtri.soloCellulare}
              onChange={(e) => set({ soloCellulare: e.target.checked })}
            />
          </CCol>

          <CCol className="d-flex align-items-end">
            <div className="text-muted small">
              <div>Totale: <strong>{totale}</strong></div>
              <div>Filtrati: <strong className="text-primary">{filtrati}</strong></div>
              <div>Con cellulare: <strong className="text-success">{conCellulare}</strong></div>
            </div>
          </CCol>

        </CRow>
      </CCardBody>
    </CCard>
  );
};

export default FiltriPazienti;
