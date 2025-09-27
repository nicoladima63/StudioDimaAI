
import React from 'react';
import { CCard, CCardBody, CCardHeader } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCog } from '@coreui/icons';
import PrestazioniSelect from '@/components/selects/PrestazioniSelect';
import { Prestazione, usePrestazioniStore } from '@/store/prestazioni.store';

interface GestioneRegoleCardProps {
  selectedPrestazione: Prestazione | null;
  onPrestazioneChange: (prestazione: Prestazione | null) => void;
}

const GestioneRegoleCard: React.FC<GestioneRegoleCardProps> = ({ 
  selectedPrestazione,
  onPrestazioneChange 
}) => {
  return (
    <CCard className='mb-4'>
      <CCardHeader>
        <h5 className='mb-0'>
          <CIcon icon={cilCog} className='me-2' />
          Gestione Regole di Monitoraggio
        </h5>
      </CCardHeader>
      <CCardBody>
        <div className='mb-3'>
          <label className='form-label'>Seleziona Prestazione da Monitorare</label>
          <div className='d-flex gap-2'>
            <PrestazioniSelect
              value={selectedPrestazione?.id || ''}
              onChange={prestazioneId => {
                if (prestazioneId) {
                  const prestazione = usePrestazioniStore
                    .getState()
                    .getPrestazioneById(prestazioneId);
                  onPrestazioneChange(prestazione);
                } else {
                  onPrestazioneChange(null);
                }
              }}
              placeholder='Seleziona prestazione...'
              className='flex-grow-1'
            />
          </div>
          {selectedPrestazione && (
            <div className='mt-2 p-2 bg-light rounded'>
              <small>
                <strong>{selectedPrestazione.nome}</strong>
                <br />
                <span className='text-muted'>
                  {selectedPrestazione.categoria} - {selectedPrestazione.codice_breve}
                </span>
              </small>
            </div>
          )}
        </div>
      </CCardBody>
    </CCard>
  );
};

export default GestioneRegoleCard;
