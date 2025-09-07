import React, { useState, useEffect } from 'react';
import { CRow, CCol, CSpinner, CBadge, CButton, CTooltip } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSave } from '@coreui/icons';
import ContiSelect from '@/components/selects/ContiSelect';
import BrancheSelect from '@/components/selects/BrancheSelect';
import SottocontiSelect from '@/components/selects/SottocontiSelect';
import classificazioniService from '../services/classificazioni.service';
import type { ClassificazioneCosto } from '../types';

interface ClassificazioneGerarchicaProps {
  fornitoreId?: string;
  fornitoreNome?: string;
  classificazione: ClassificazioneCosto | null;
  onClassificazioneChange?: (nuovaClassificazione: ClassificazioneCosto | null) => void;
  onSave?: (
    contoid: number,
    brancaid: number | null,
    sottocontoid: number | null,
    tipo: 'solo-conto' | 'conto-branca' | 'completa'
  ) => Promise<void>;
}

const ClassificazioneGerarchica: React.FC<ClassificazioneGerarchicaProps> = ({
  fornitoreId,
  fornitoreNome,
  classificazione,
  onClassificazioneChange,
  onSave,
}) => {
  const [updating, setUpdating] = useState(false);
  const [contoId, setContoId] = useState<number | null>(null);
  const [brancaId, setBrancaId] = useState<number | null>(null);
  const [sottocontoId, setSottocontoId] = useState<number | null>(null);

  useEffect(() => {
    if (classificazione) {
      setContoId(classificazione.contoid || null);
      setBrancaId(classificazione.brancaid || null);
      setSottocontoId(classificazione.sottocontoid || null);
    } else {
      setContoId(null);
      setBrancaId(null);
      setSottocontoId(null);
    }
  }, [classificazione]);

  const handleContoChange = (newContoId: number | null) => {
    setContoId(newContoId);
    setBrancaId(null);
    setSottocontoId(null);
  };

  const handleBrancaChange = (newBrancaId: number | null) => {
    setBrancaId(newBrancaId);
    setSottocontoId(null);
  };

  const handleSottocontoChange = async (newSottocontoId: number | null) => {
    setSottocontoId(newSottocontoId);

    if (contoId && brancaId && newSottocontoId && !updating) {
      setUpdating(true);
      try {
        if (onSave) {
          await onSave(contoId, brancaId, newSottocontoId, 'completa');
        } else if (fornitoreId) {
          await classificazioniService.salvaClassificazioneFornitoreCompleta(fornitoreId, {
            tipo_di_costo: classificazione?.tipo_di_costo || 1,
            contoid: contoId,
            brancaid: brancaId,
            sottocontoid: newSottocontoId,
            fornitore_nome: fornitoreNome || '',
          });
        }
      } catch (error) {
        console.error('❌ Errore nel salvataggio della classificazione:', error);
      } finally {
        setUpdating(false);
      }

          onClassificazioneChange?.({
            ...classificazione,
            contoid: contoId,
            brancaid: brancaId,
            sottocontoid: newSottocontoId,
            data_modifica: new Date().toISOString(),
          });
    }
  };

  const isCompleto = contoId && brancaId && sottocontoId;
  const isParziale = contoId && brancaId === 0 && sottocontoId === 0;
  const isContoSolamente = contoId && !brancaId && !sottocontoId;
  const isContoBranca = contoId && brancaId && brancaId > 0 && !sottocontoId;

  const handleSalvaParziale = async (
    tipo: 'solo-conto' | 'conto-branca' = 'solo-conto'
  ) => {
    if (contoId) {
      setUpdating(true);
      try {
        if (tipo === 'conto-branca' && brancaId) {
          if (onSave) {
            await onSave(contoId, brancaId, 0, 'conto-branca');
          } else if (fornitoreId) {
            await classificazioniService.salvaClassificazioneFornitoreCompleta(fornitoreId, {
              tipo_di_costo: classificazione?.tipo_di_costo || 1,
              contoid: contoId,
              brancaid: brancaId,
              sottocontoid: 0,
              fornitore_nome: fornitoreNome || '',
            });
          }
          setSottocontoId(0);

          onClassificazioneChange?.({
            ...classificazione,
            contoid: contoId,
            brancaid: tipo === 'conto-branca' ? brancaId : 0,
            sottocontoid: 0,
            data_modifica: new Date().toISOString(),
          });
          
        } else {
          if (onSave) {
            await onSave(contoId, 0, 0, 'solo-conto');
          } else if (fornitoreId) {
            await classificazioniService.salvaClassificazioneFornitoreCompleta(fornitoreId, {
              tipo_di_costo: classificazione?.tipo_di_costo || 1,
              contoid: contoId,
              brancaid: 0,
              sottocontoid: 0,
              fornitore_nome: fornitoreNome || '',
            });
          }
          setBrancaId(0);
          setSottocontoId(0);

          onClassificazioneChange?.({
            ...classificazione,
            contoid: contoId,
            brancaid: 0,
            sottocontoid: 0,
            data_modifica: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('❌ Errore nel salvataggio della classificazione parziale:', error);
      } finally {
        setUpdating(false);
      }
    }
  };
  // Rimuovo il return early per updating - ora mostriamo il spinner inline

  return (
    <div className="d-flex flex-column gap-2" style={{ minWidth: '320px' }}>
      {/* Conto */}
      <div className="d-flex gap-2 align-items-center">
        <div style={{ flex: 1 }}>
          <ContiSelect 
            value={contoId}
            onChange={handleContoChange}
            autoSelectIfSingle
          />
        </div>
        
        {/* Pulsante salva parziale - appare solo quando c'è conto ma non branca */}
        {isContoSolamente && !updating && (
          <CTooltip content="Salva solo conto (classificazione parziale)">
            <CButton
              color="warning"
              variant="outline"
              size="sm"
              onClick={() => handleSalvaParziale('solo-conto')}
            >
              <CIcon icon={cilSave} size="sm" />
            </CButton>
          </CTooltip>
        )}
      </div>
      
      {/* Branca - appare solo dopo selezione conto */}
      {contoId && (
        <div className="d-flex gap-2 align-items-center">
          <div style={{ flex: 1 }}>
            <BrancheSelect
              contoId={contoId}
              value={brancaId}
              onChange={handleBrancaChange}
              autoSelectIfSingle
            />
          </div>
          
          {/* Pulsante salva parziale per conto+branca */}
          {isContoBranca && !updating && (
            <CTooltip content="Salva conto + branca (classificazione parziale)">
              <CButton
                color="warning"
                variant="outline"
                size="sm"
                onClick={() => handleSalvaParziale('conto-branca')}
              >
                <CIcon icon={cilSave} size="sm" />
              </CButton>
            </CTooltip>
          )}
        </div>
      )}
      
      {/* Sottoconto - appare solo dopo selezione branca */}
      {brancaId && (
        <div>
          <SottocontiSelect
            brancaId={brancaId}
            value={sottocontoId}
            onChange={handleSottocontoChange}
            autoSelectIfSingle
          />
        </div>
      )}
      
      {/* Badge di stato */}
      {isCompleto && (
        <CBadge color="success" className="align-self-center mt-2">
          ✓ Classificazione Completa
        </CBadge>
      )}
      
      {isParziale && (
        <CBadge color="warning" className="align-self-center mt-2">
          💾 Conto Salvato (Classificazione Parziale)
        </CBadge>
      )}
      
      {contoId && brancaId && brancaId > 0 && sottocontoId === 0 && (
        <CBadge color="warning" className="align-self-center mt-2">
          💾 Conto + Branca Salvati (Classificazione Parziale)
        </CBadge>
      )}
      
      {updating && (
        <div className="text-center">
          <CSpinner size="sm" className="me-2" />
          <small>Salvataggio...</small>
        </div>
      )}
    </div>
  );
};

export default ClassificazioneGerarchica;