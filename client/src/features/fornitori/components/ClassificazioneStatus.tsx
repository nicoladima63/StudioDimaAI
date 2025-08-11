import React, { useState, useEffect } from 'react';
import { CBadge, CButton, CTooltip, CSpinner } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPencil, cilCheckCircle, cilWarning } from '@coreui/icons';
import ClassificazioneGerarchica from './ClassificazioneGerarchica';
import type { ClassificazioneCosto } from '../types';
import { useConti, useBranche, useSottoconti } from '@/store/contiStore';

interface ClassificazioneStatusProps {
  fornitoreId: string;
  classificazione: ClassificazioneCosto | null;
  onClassificazioneChange?: (contoid: number | null, brancaid: number | null, sottocontoid: number | null) => void;
}

const ClassificazioneStatus: React.FC<ClassificazioneStatusProps> = ({
  fornitoreId,
  classificazione,
  onClassificazioneChange
}) => {
  const [showEdit, setShowEdit] = useState(false);
  const [contoNome, setContoNome] = useState<string>('');
  const [brancaNome, setBrancaNome] = useState<string>('');
  const [sottocontoNome, setSottocontoNome] = useState<string>('');

  // Hooks per ottenere i nomi
  const { conti, isLoading: contiLoading } = useConti();
  const { branche, isLoading: brancheLoading } = useBranche(classificazione?.contoid || null);
  const { sottoconti, isLoading: sottocontiLoading } = useSottoconti(classificazione?.brancaid || null);

  // Aggiorna i nomi quando cambiano i dati
  useEffect(() => {
    if (classificazione && conti.length > 0) {
      const conto = conti.find(c => c.id === classificazione.contoid);
      setContoNome(conto?.nome || `Conto ID: ${classificazione.contoid}`);
    } else {
      setContoNome('');
    }
  }, [classificazione, conti]);

  useEffect(() => {
    if (classificazione?.brancaid && branche.length > 0) {
      const branca = branche.find(b => b.id === classificazione.brancaid);
      setBrancaNome(branca?.nome || `Branca ID: ${classificazione.brancaid}`);
    } else {
      setBrancaNome('');
    }
  }, [classificazione, branche]);

  useEffect(() => {
    if (classificazione?.sottocontoid && sottoconti.length > 0) {
      const sottoconto = sottoconti.find(s => s.id === classificazione.sottocontoid);
      setSottocontoNome(sottoconto?.nome || `Sottoconto ID: ${classificazione.sottocontoid}`);
    } else {
      setSottocontoNome('');
    }
  }, [classificazione, sottoconti]);

  // Determina il tipo di classificazione
  const getClassificationType = () => {
    if (!classificazione) return 'non_classificato';
    
    const hasContoid = classificazione.contoid && classificazione.contoid > 0;
    const hasBrancaid = classificazione.brancaid && classificazione.brancaid > 0;
    const hasSottocontoid = classificazione.sottocontoid && classificazione.sottocontoid > 0;
    
    if (hasContoid && hasBrancaid && hasSottocontoid) {
      return 'completo';
    } else if (hasContoid && (
      (!classificazione.brancaid || classificazione.brancaid === 0) ||  // Solo conto
      (hasBrancaid && (!classificazione.sottocontoid || classificazione.sottocontoid === 0))  // Conto + branca
    )) {
      return 'parziale';
    } else {
      return 'non_classificato';
    }
  };

  const classificationType = getClassificationType();

  // Se stiamo modificando, mostra il componente di modifica
  if (showEdit) {
    return (
      <div className="d-flex flex-column gap-2">
        <ClassificazioneGerarchica
          fornitoreId={fornitoreId}
          classificazione={classificazione}
          onClassificazioneChange={(contoid, brancaid, sottocontoid) => {
            if (onClassificazioneChange) {
              onClassificazioneChange(contoid, brancaid, sottocontoid);
            }
            setShowEdit(false); // Chiudi la modalità edit dopo QUALSIASI salvataggio (completo o parziale)
          }}
        />
        <CButton
          color="secondary"
          size="sm"
          variant="ghost"
          onClick={() => setShowEdit(false)}
        >
          Annulla
        </CButton>
      </div>
    );
  }

  // Visualizzazione dello stato
  const renderStatus = () => {
    if (contiLoading || brancheLoading || sottocontiLoading) {
      return <CSpinner size="sm" />;
    }

    switch (classificationType) {
      case 'completo':
        return (
          <div className="d-flex align-items-center justify-content-center gap-1">
            <CTooltip content={`Completo: ${contoNome} → ${brancaNome} → ${sottocontoNome}`}>
              <CBadge 
                color="success" 
                style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '2px',
                  display: 'inline-block',
                  padding: 0
                }}
              />
            </CTooltip>
            <CTooltip content="Modifica classificazione">
              <CButton
                color="success"
                size="sm"
                variant="ghost"
                onClick={() => setShowEdit(true)}
                style={{
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  minWidth: 'unset',
                  borderRadius: '2px'
                }}
              >
                <CIcon icon={cilPencil} size="sm" />
              </CButton>
            </CTooltip>
          </div>
        );

      case 'parziale':
        const tooltipContent = classificazione?.brancaid && classificazione.brancaid > 0
          ? `Parziale: ${contoNome} → ${brancaNome} (manca sottoconto)`
          : `Parziale: ${contoNome} (manca branca/sottoconto)`;
        return (
          <div className="d-flex align-items-center justify-content-center gap-1">
            <CTooltip content={tooltipContent}>
              <CBadge 
                style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '2px',
                  display: 'inline-block',
                  padding: 0,
                  backgroundColor: '#ff8c00',  // Arancione per parziale
                  border: 'none'
                }}
              />
            </CTooltip>
            <CTooltip content="Completa classificazione">
              <CButton
                size="sm"
                variant="ghost"
                onClick={() => setShowEdit(true)}
                style={{
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  minWidth: 'unset',
                  borderRadius: '2px',
                  color: '#ff8c00'  // Testo arancione
                }}
              >
                <CIcon icon={cilPencil} size="sm" />
              </CButton>
            </CTooltip>
          </div>
        );

      case 'non_classificato':
      default:
        return (
          <div className="d-flex align-items-center justify-content-center gap-1">
            <CTooltip content="Non classificato">
              <CBadge 
                color="danger" 
                style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '2px',
                  display: 'inline-block',
                  padding: 0
                }}
              />
            </CTooltip>
            <CTooltip content="Aggiungi classificazione">
              <CButton
                color="primary"
                size="sm"
                variant="outline"
                onClick={() => setShowEdit(true)}
                style={{
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  minWidth: 'unset',
                  borderRadius: '2px'
                }}
              >
                <CIcon icon={cilPencil} size="sm" />
              </CButton>
            </CTooltip>
          </div>
        );
    }
  };

  return (
    <div className="text-center">
      {renderStatus()}
    </div>
  );
};

export default ClassificazioneStatus;