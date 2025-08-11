import React, { useState, useEffect } from 'react';
import { CRow, CCol, CSpinner, CBadge, CButton, CTooltip } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSave } from '@coreui/icons';
import SelectConto from '@/components/selects/SelectConto';
import { SelectBranca } from '@/components/selects/SelectBranca';
import { SelectSottoconto } from '@/components/selects/SelectSottoconto';
import classificazioniService from '../services/classificazioni.service';
import type { ClassificazioneCosto } from '../types';

interface ClassificazioneGerarchicaProps {
  fornitoreId: string;
  classificazione: ClassificazioneCosto | null;
  onClassificazioneChange?: (contoid: number | null, brancaid: number | null, sottocontoid: number | null) => void;
}

const ClassificazioneGerarchica: React.FC<ClassificazioneGerarchicaProps> = ({
  fornitoreId,
  classificazione,
  onClassificazioneChange
}) => {
  const [updating, setUpdating] = useState(false);
  const [contoId, setContoId] = useState<number | null>(null);
  const [brancaId, setBrancaId] = useState<number | null>(null);
  const [sottocontoId, setSottocontoId] = useState<number | null>(null);

  // Carica la classificazione esistente SOLO quando cambia la prop classificazione
  useEffect(() => {
    if (classificazione) {
      // Se esiste una classificazione con i nuovi campi numerici, usali
      setContoId(classificazione.contoid || null);
      setBrancaId(classificazione.brancaid || null);
      setSottocontoId(classificazione.sottocontoid || null);
    } else {
      // Reset quando non c'è classificazione
      setContoId(null);
      setBrancaId(null);
      setSottocontoId(null);
    }
  }, [classificazione]); // SOLO classificazione nelle dipendenze!

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
    
    // Solo quando abbiamo tutti i campi, salva (e non stiamo già aggiornando)
    if (contoId && brancaId && newSottocontoId && !updating) {
      setUpdating(true);
      try {
        // Salva la classificazione completa
        await classificazioniService.salvaClassificazioneFornitoreCompleta(
          fornitoreId,
          {
            tipo_di_costo: classificazione?.tipo_di_costo || 1,
            contoid: contoId,
            brancaid: brancaId,
            sottocontoid: newSottocontoId
          }
        );
        
        // Toast di successo per feedback chiaro
        console.log('✅ Fornitore classificato con successo!');
        
        // Chiama il callback solo quando la classificazione è COMPLETA e SALVATA
        if (onClassificazioneChange) {
          onClassificazioneChange(contoId, brancaId, newSottocontoId);
        }
      } catch (error) {
        console.error('❌ Errore nel salvataggio della classificazione:', error);
        // Potresti aggiungere qui un toast di errore
      } finally {
        setUpdating(false);
      }
    }
  };

  const isCompleto = contoId && brancaId && sottocontoId;
  const isParziale = contoId && brancaId === 0 && sottocontoId === 0;
  const isContoSolamente = contoId && !brancaId && !sottocontoId;
  const isContoBranca = contoId && brancaId && brancaId > 0 && !sottocontoId;

  const handleSalvaParziale = async (tipo: 'solo-conto' | 'conto-branca' = 'solo-conto') => {
    if (contoId) {
      setUpdating(true);
      try {
        if (tipo === 'conto-branca' && brancaId) {
          // Salva classificazione parziale con conto + branca
          await classificazioniService.salvaClassificazioneFornitoreCompleta(
            fornitoreId,
            {
              tipo_di_costo: classificazione?.tipo_di_costo || 1,
              contoid: contoId,
              brancaid: brancaId,
              sottocontoid: 0  // 0 indica che sottoconto non è necessario
            }
          );
          
          setSottocontoId(0);
          console.log('💾 Classificazione parziale salvata (conto + branca)');
          
          if (onClassificazioneChange) {
            onClassificazioneChange(contoId, brancaId, 0);
          }
        } else {
          // Salva classificazione parziale con solo conto
          await classificazioniService.salvaClassificazioneFornitoreCompleta(
            fornitoreId,
            {
              tipo_di_costo: classificazione?.tipo_di_costo || 1,
              contoid: contoId,
              brancaid: 0,  // 0 indica "parziale ma salvato"
              sottocontoid: 0  // 0 indica "parziale ma salvato"
            }
          );
          
          // Aggiorna stato locale per riflettere il salvataggio parziale
          setBrancaId(0);
          setSottocontoId(0);
          
          console.log('💾 Classificazione parziale salvata (solo conto)');
          
          if (onClassificazioneChange) {
            onClassificazioneChange(contoId, 0, 0);
          }
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
          <SelectConto 
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
            <SelectBranca
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
          <SelectSottoconto
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