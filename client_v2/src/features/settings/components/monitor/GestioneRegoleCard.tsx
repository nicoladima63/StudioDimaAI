
import React, { useState, useEffect } from 'react';
import { CCard, CCardBody, CCardHeader, CFormSelect, CFormLabel, CSpinner } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilList } from '@coreui/icons';
import { Prestazione, usePrestazioniStore } from '@/store/prestazioni.store';
import Select from 'react-select';

interface GestioneRegoleCardProps {
  selectedPrestazione: Prestazione | null;
  onPrestazioneChange: (prestazione: Prestazione | null) => void;
}

const GestioneRegoleCard: React.FC<GestioneRegoleCardProps> = ({
  selectedPrestazione,
  onPrestazioneChange,
}) => {
  const { categorieList, loadPrestazioni, isLoading } = usePrestazioniStore();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [prestationsOptions, setPrestationsOptions] = useState<{ value: string; label: string; prestazione: Prestazione }[]>([]);

  useEffect(() => {
    loadPrestazioni();
  }, [loadPrestazioni]);

  // Aggiorna le opzioni delle prestazioni quando cambia la categoria o la lista delle categorie
  useEffect(() => {
    const currentCategory = categorieList.find(cat => cat.categoria_id === selectedCategoryId);
    const prestationsInSelectedCategory = currentCategory ? currentCategory.prestazioni : [];

    const options = prestationsInSelectedCategory.map(p => ({
      value: p.id,
      label: p.nome,
      prestazione: p, // Salva l'oggetto completo per un facile recupero
    }));
    setPrestationsOptions(options);
  }, [selectedCategoryId, categorieList]);

  // Sincronizza la categoria selezionata con la prestazione esterna
  useEffect(() => {
    if (selectedPrestazione && selectedPrestazione.categoria_id !== selectedCategoryId) {
      setSelectedCategoryId(selectedPrestazione.categoria_id);
    }
  }, [selectedPrestazione, selectedCategoryId]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategoryId = Number(e.target.value);
    setSelectedCategoryId(newCategoryId);
    onPrestazioneChange(null); // Resetta la prestazione quando cambia la categoria
  };

  const handlePrestazioneSelectChange = (option: { value: string; label: string; prestazione: Prestazione } | null) => {
    onPrestazioneChange(option ? option.prestazione : null);
  };

  const selectedPrestazioneOption = selectedPrestazione ? {
    value: selectedPrestazione.id,
    label: selectedPrestazione.nome,
    prestazione: selectedPrestazione,
  } : null;

  return (
    <CCard className='mb-4'>
      <CCardHeader>
        <h5 className='mb-0'>
          <CIcon icon={cilList} className='me-2' />
          Prestazione Trigger
        </h5>
      </CCardHeader>
      <CCardBody>
        {isLoading ? (
          <div className='d-flex justify-content-center align-items-center' style={{ height: '100px' }}>
            <CSpinner size='sm' aria-hidden='true' />
            <span className='ms-2'>Caricamento prestazioni...</span>
          </div>
        ) : (
          <>
            <div className='mb-3'>
              <CFormLabel htmlFor='categorySelect'>Seleziona Categoria</CFormLabel>
              <CFormSelect
                id='categorySelect'
                value={selectedCategoryId || ''}
                onChange={handleCategoryChange}
                disabled={isLoading}
              >
                <option value=''>-- Seleziona una categoria --</option>
                {categorieList.map(cat => (
                  <option key={cat.categoria_id} value={cat.categoria_id}>{cat.categoria_nome}</option>
                ))}
              </CFormSelect>
            </div>

            {selectedCategoryId && (
              <div className='mb-3'>
                <CFormLabel htmlFor='prestazioneSelect'>Cerca e Seleziona Prestazione</CFormLabel>
                <Select
                  inputId='prestazioneSelect'
                  options={prestationsOptions}
                  value={selectedPrestazioneOption}
                  onChange={handlePrestazioneSelectChange}
                  isClearable
                  placeholder='Digita per cercare...'
                  isDisabled={isLoading}
                  noOptionsMessage={() => "Nessuna prestazione trovata"}
                />
              </div>
            )}
          </>
        )}
      </CCardBody>
    </CCard>
  );
};
export default GestioneRegoleCard;
