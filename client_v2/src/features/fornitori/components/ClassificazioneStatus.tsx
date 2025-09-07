import React, { useState, useEffect } from 'react';
import { CBadge, CButton, CTooltip, CSpinner } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPencil, cilTrash } from '@coreui/icons';
import ClassificazioneGerarchica from './ClassificazioneGerarchica';
import type { ClassificazioneCosto } from '../types';
import { useConti, useBranche, useSottoconti } from '@/store/conti.store';

interface ClassificazioneStatusProps {
  fornitoreId: string;
  fornitoreNome?: string;
  classificazione: ClassificazioneCosto | null;
  onClassificazioneChange?: (
    contoid: number | null,
    brancaid: number | null,
    sottocontoid: number | null
  ) => void;
}

const ClassificazioneStatus: React.FC<ClassificazioneStatusProps> = ({
  fornitoreId,
  fornitoreNome,
  classificazione,
  onClassificazioneChange,
}) => {
  const [showEdit, setShowEdit] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Calcola i nomi direttamente dal render (senza useState)
  const getContoNome = () => {
    if (!classificazione?.contoid || conti.length === 0) return '';
    const conto = conti.find(c => c.id === classificazione.contoid);
    return conto?.nome || `Conto ID: ${classificazione.contoid}`;
  };

  const getBrancaNome = () => {
    if (!classificazione?.brancaid || branche.length === 0) return '';
    const branca = branche.find(b => b.id === classificazione.brancaid);
    return branca?.nome || `Branca ID: ${classificazione.brancaid}`;
  };

  const getSottocontoNome = () => {
    if (!classificazione?.sottocontoid || sottoconti.length === 0) return '';
    const sottoconto = sottoconti.find(s => s.id === classificazione.sottocontoid);
    return sottoconto?.nome || `Sottoconto ID: ${classificazione.sottocontoid}`;
  };

  // Hooks per ottenere i nomi
  const { conti, isLoading: contiLoading } = useConti();
  const { branche, isLoading: brancheLoading } = useBranche(classificazione?.contoid || null);
  const { sottoconti, isLoading: sottocontiLoading } = useSottoconti(
    classificazione?.brancaid || null
  );

  // Determina il tipo di classificazione
  const getClassificationType = () => {
    if (!classificazione) return 'non_classificato';

    const hasContoid = classificazione.contoid && classificazione.contoid > 0;
    const hasBrancaid = classificazione.brancaid && classificazione.brancaid > 0;
    const hasSottocontoid = classificazione.sottocontoid && classificazione.sottocontoid > 0;

    if (hasContoid && hasBrancaid && hasSottocontoid) {
      return 'completo';
    } else if (
      hasContoid &&
      (!classificazione.brancaid ||
        classificazione.brancaid === 0 || // Solo conto
        (hasBrancaid && (!classificazione.sottocontoid || classificazione.sottocontoid === 0))) // Conto + branca
    ) {
      return 'parziale';
    } else {
      return 'non_classificato';
    }
  };

  const classificationType = getClassificationType();

  const handleRemoveClassificazione = async () => {
    if (removing || !classificazione) return;

    // Dialog di conferma
    if (!window.confirm('Sei sicuro di voler rimuovere la classificazione?')) {
      return;
    }

    setRemoving(true);
    try {
      const classificazioniService = await import('../services/classificazioni.service');
      const response =
        await classificazioniService.default.rimuoviClassificazioneFornitore(fornitoreId);

      if (response.success) {
        onClassificazioneChange?.(null);
      }
    } catch (error) {
      console.error('Errore nella rimozione classificazione:', error);
    } finally {
      setRemoving(false);
    }
  };

  // Se stiamo modificando, mostra il componente di modifica
  if (showEdit) {
    return (
      <div className='d-flex flex-column gap-2'>
        <ClassificazioneGerarchica
          fornitoreId={fornitoreId}
          fornitoreNome={fornitoreNome}
          classificazione={classificazione}
          onClassificazioneChange={nuova => {
            onClassificazioneChange?.(nuova);
            setShowEdit(false);
          }}
        />
        <CButton color='secondary' size='sm' variant='ghost' onClick={() => setShowEdit(false)}>
          Annulla
        </CButton>
      </div>
    );
  }

  const styled = () => {
    return {
      padding: '0.575rem 0.75rem', // Stesse dimensioni del CButton size="sm"
      fontSize: '0.875rem', // Font size uguale al CButton
      fontWeight: '400',
      borderRadius: '0.25rem',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '80px',
    };
  };

  // Visualizzazione dello stato
  const renderStatus = () => {
    if (contiLoading || brancheLoading || sottocontiLoading) {
      return <CSpinner size='sm' />;
    }

    switch (classificationType) {
      case 'completo':
        return (
          <div
            className='d-flex align-items-center justify-content-between'
            style={{ width: '100%' }}
          >
            {/* Badge container - float left */}
            <div className='d-flex align-items-center gap-2'>
              {/* Badge conto */}
              <CBadge color='primary' className='text-nowrap' style={styled()}>
                {getContoNome()}
              </CBadge>

              {/* Badge branca con freccia condizionale */}
              {getBrancaNome() && (
                <>
                  <span style={{ color: '#666', fontSize: '14px' }}>→</span>
                  <CBadge color='info' className='text-nowrap' style={styled()}>
                    {getBrancaNome()}
                  </CBadge>
                </>
              )}

              {/* Badge sottoconto con freccia condizionale */}
              {getSottocontoNome() && (
                <>
                  <span style={{ color: '#666', fontSize: '14px' }}>→</span>
                  <CBadge color='success' className='text-nowrap' style={styled()}>
                    {getSottocontoNome()}
                  </CBadge>
                </>
              )}
            </div>

            {/* Action buttons - float right */}
            <div className='d-flex align-items-center gap-1'>
              <CTooltip content='Modifica classificazione'>
                <CButton
                  color='secondary'
                  size='sm'
                  variant='outline'
                  onClick={() => setShowEdit(true)}
                  disabled={removing}
                >
                  <CIcon icon={cilPencil} size='sm' />
                </CButton>
              </CTooltip>

              <CTooltip content='Rimuovi classificazione'>
                <CButton
                  color='danger'
                  size='sm'
                  variant='outline'
                  onClick={handleRemoveClassificazione}
                  disabled={removing}
                >
                  {removing ? <CSpinner size='sm' /> : <CIcon icon={cilTrash} size='sm' />}
                </CButton>
              </CTooltip>
            </div>
          </div>
        );

      case 'parziale':
        return (
          <div
            className='d-flex align-items-center justify-content-between'
            style={{ width: '100%' }}
          >
            {/* Badge container - float left */}
            <div className='d-flex align-items-center gap-2'>
              {/* Badge conto (sempre presente) */}
              <CBadge color='primary' className='text-nowrap' style={styled()}>
                {getContoNome().length > 12
                  ? getContoNome().substring(0, 12) + '...'
                  : getContoNome()}
              </CBadge>

              {/* Badge branca con freccia condizionale (se presente) */}
              {getBrancaNome() && (
                <>
                  <span style={{ color: '#666', fontSize: '14px' }}>→</span>
                  <CBadge
                    className='text-nowrap'
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: '400',
                      borderRadius: '0.25rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '80px',
                      backgroundColor: '#ff8c00', // Arancione per parziale
                      color: 'white',
                      border: 'none',
                    }}
                  >
                    {getBrancaNome().length > 12
                      ? getBrancaNome().substring(0, 12) + '...'
                      : getBrancaNome()}
                  </CBadge>
                </>
              )}
            </div>

            {/* Action buttons - float right */}
            <div className='d-flex align-items-center gap-1'>
              <CTooltip content='Completa classificazione'>
                <CButton
                  size='sm'
                  variant='outline'
                  onClick={() => setShowEdit(true)}
                  disabled={removing}
                  style={{
                    color: '#ff8c00', // Testo arancione
                    borderColor: '#ff8c00',
                  }}
                >
                  <CIcon icon={cilPencil} size='sm' />
                </CButton>
              </CTooltip>

              <CTooltip content='Rimuovi classificazione'>
                <CButton
                  color='danger'
                  size='sm'
                  variant='outline'
                  onClick={handleRemoveClassificazione}
                  disabled={removing}
                >
                  {removing ? <CSpinner size='sm' /> : <CIcon icon={cilTrash} size='sm' />}
                </CButton>
              </CTooltip>
            </div>
          </div>
        );

      case 'non_classificato':
      default:
        return (
          <div
            className='d-flex align-items-center justify-content-between'
            style={{ width: '100%' }}
          >
            {/* Badge container - float left */}
            <div className='d-flex align-items-center gap-2'>
              <CButton
                color='warning'
                variant='outline'
                size='sm'
                className='text-nowrap'
                onClick={() => setShowEdit(true)}
              >
                DA CLASSIFICARE
              </CButton>
            </div>

            {/* Action buttons - float right */}
            <div className='d-flex align-items-center gap-1'>
              <CTooltip content='Aggiungi classificazione'>
                <CButton
                  color='primary'
                  size='sm'
                  variant='outline'
                  onClick={() => setShowEdit(true)}
                >
                  <CIcon icon={cilPencil} size='sm' />
                </CButton>
              </CTooltip>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <div>{renderStatus()}</div>
    </>
  );
};

export default ClassificazioneStatus;
