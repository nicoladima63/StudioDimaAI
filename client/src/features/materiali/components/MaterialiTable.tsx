import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CButton,
  CBadge,
  CSpinner,
  CAlert,
  CRow,
  CCol,
  CToast,
  CToastBody,
  CToaster,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCheckCircle, cilX, cilMedicalCross, cilArrowTop, cilArrowBottom, cilReload } from '@coreui/icons';
import materialiService, { type MaterialeIntelligente } from '../services/materiali.service';
import type { FornitoreItem } from '../types';
import ClassificazioneGerarchica from '@/features/fornitori/components/ClassificazioneGerarchica';
import MaterialeClassificazioneStatus from './MaterialeClassificazioneStatus';
import { useContiStore } from '@/store/contiStore';

interface MaterialiTableProps {
  fornitoreSelezionato: FornitoreItem | null;
}

interface MaterialeClassificazione {
  id: string;
  materiale: MaterialeIntelligente;
  classificazione: {
    contoid: number | null;
    brancaid: number | null;
    sottocontoid: number | null;
  };
  stato: 'gia_classificato' | 'suggerito' | 'confermato' | 'modificato' | 'in_modifica' | 'da_verificare';
}

type SortField = 'codice_articolo' | 'nome' | 'stato';
type SortDirection = 'asc' | 'desc';

const MaterialiTable: React.FC<MaterialiTableProps> = ({ fornitoreSelezionato }) => {
  const [materiali, setMateriali] = useState<MaterialeClassificazione[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [toast, setToast] = useState<React.ReactElement[]>([]);
  const { conti, brancheMap, sottocontiMap } = useContiStore();
  
  // Funzione per creare toast di sincronizzazione
  const addSyncToast = () => {
    const newToast = (
      <CToast key="sync-toast" autohide={false} visible={true} color="info">
        <CToastBody>
          <div className="d-flex align-items-center">
            <CSpinner size="sm" className="me-2" />
            <strong>Sincronizzazione suggerimenti in corso...</strong>
          </div>
        </CToastBody>
      </CToast>
    );
    setToast([newToast]);
  };

  // Funzione per rimuovere toast di sincronizzazione
  const removeSyncToast = () => {
    setToast([]);
  };
  
  // Funzione per salvare classificazione materiale
  const handleSalvaMateriale = async (
    materialeItem: MaterialeClassificazione, 
    contoid: number, 
    brancaid: number | null, 
    sottocontoid: number | null, 
    tipo: 'solo-conto' | 'conto-branca' | 'completa'
  ) => {
    try {
      // Ottieni i nomi dai store
      const conto = conti?.find(c => c.id === contoid);
      const branca = brancaid ? brancheMap?.[brancaid] : null;
      const sottoconto = sottocontoid ? sottocontiMap?.[sottocontoid] : null;

      const datiSalvataggio = {
        codice_articolo: materialeItem.materiale.codice_articolo || '',
        descrizione: materialeItem.materiale.descrizione,
        codice_fornitore: fornitoreSelezionato?.codice_riferimento || '',
        nome_fornitore: fornitoreSelezionato?.fornitore_nome || '',
        contoid,
        contonome: conto?.nome,
        brancaid,
        brancanome: branca,
        sottocontoid,
        sottocontonome: sottoconto,
        // Dati costo e fattura dal materiale
        data_fattura: materialeItem.materiale.data_fattura,
        costo_unitario: materialeItem.materiale.prezzo_unitario,
        fattura_id: materialeItem.materiale.fattura_id,
        riga_fattura_id: materialeItem.materiale.riga_fattura_id
      };

      const response = await materialiService.apiSalvaClassificazioneMateriale(datiSalvataggio);
      
      if (response.success) {
        console.log(`✅ Materiale classificato (${tipo}):`, response.message);
        // Aggiorna stato locale
        setMateriali(prev =>
          prev.map(mat =>
            mat.id === materialeItem.id ? { 
              ...mat, 
              stato: 'modificato',
              classificazione: { contoid, brancaid, sottocontoid }
            } : mat
          )
        );
      } else {
        setError(response.error || 'Errore nel salvataggio della classificazione');
      }
    } catch (error) {
      console.error('❌ Errore salvataggio materiale:', error);
      setError('Errore nel salvataggio della classificazione');
    }
  };

  // Funzioni di ordinamento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortMateriali = (materialiList: MaterialeClassificazione[]) => {
    return [...materialiList].sort((a, b) => {
      let aValue: string;
      let bValue: string;
      
      switch (sortField) {
        case 'codice_articolo':
          aValue = a.materiale.codice_articolo || '';
          bValue = b.materiale.codice_articolo || '';
          break;
        case 'nome':
          aValue = a.materiale.descrizione || '';
          bValue = b.materiale.descrizione || '';
          break;
        case 'stato':
          aValue = a.stato;
          bValue = b.stato;
          break;
        default:
          return 0;
      }
      
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? cilArrowTop : cilArrowBottom;
  };

  // Funzione per caricare materiali
  const loadMateriali = async () => {
    if (!fornitoreSelezionato) {
      setMateriali([]);
      return;
    }

    setLoading(true);
    setError(null);
    addSyncToast(); // Mostra toast di sincronizzazione

    try {
      const response = await materialiService.apiGetMaterialiIntelligenti(
        fornitoreSelezionato.codice_riferimento,
        { show_classified: true }
      );

      if (response.success) {
        // Trasforma in MaterialeClassificazione con stati corretti
        const materialiClassificati = response.data.map((mat, index) => {
          // Determina lo stato in base al motivo della classificazione
          let stato: 'gia_classificato' | 'suggerito' | 'confermato' | 'modificato' | 'in_modifica' | 'da_verificare';
          
          const motivo = mat.classificazione_suggerita.motivo || '';
          const confidence = mat.classificazione_suggerita.confidence;
          
          // Se il motivo indica che è già stato classificato manualmente
          if (motivo.includes('manuale') || motivo.includes('confermato') || motivo.includes('salvato')) {
            stato = 'gia_classificato';
          } else if (confidence > 80) {
            stato = 'suggerito';
          } else {
            stato = 'da_verificare';
          }
          
          return {
            id: `${mat.riga_originale_id || index}`,
            materiale: mat,
            classificazione: {
              contoid: mat.classificazione_suggerita.contoid,
              brancaid: mat.classificazione_suggerita.brancaid,
              sottocontoid: mat.classificazione_suggerita.sottocontoid
            },
            stato
          };
        });

        setMateriali(materialiClassificati);
      } else {
        setError(response.error || 'Errore caricamento materiali');
      }
    } catch (err: any) {
      setError('Errore nella comunicazione con il server');
    } finally {
      setLoading(false);
      removeSyncToast(); // Nascondi toast di sincronizzazione
    }
  };

  // Carica materiali quando cambia fornitore
  useEffect(() => {
    loadMateriali();
  }, [fornitoreSelezionato]);


  // Conferma classificazione suggerita
  const handleConfermaClassificazione = (id: string) => {
    setMateriali(prev =>
      prev.map(mat =>
        mat.id === id ? { ...mat, stato: 'confermato' } : mat
      )
    );
  };

  // Avvia modifica classificazione
  const handleModificaClassificazione = (id: string) => {
    setMateriali(prev =>
      prev.map(mat =>
        mat.id === id ? { ...mat, stato: 'in_modifica' } : mat
      )
    );
  };



  // Conferma tutti i suggerimenti verdi
  const handleConfermaTuttiVerdi = async () => {
    if (!fornitoreSelezionato) return;
    
    // Filtra materiali verdi da confermare
    const materialiDaConfermare = materiali.filter(mat =>
      mat.materiale.classificazione_suggerita.confidence > 80 && mat.stato === 'suggerito'
    );

    if (materialiDaConfermare.length === 0) return;

    setLoading(true);
    // Toast per salvataggio batch
    const saveToast = (
      <CToast key="save-toast" autohide={false} visible={true} color="warning">
        <CToastBody>
          <div className="d-flex align-items-center">
            <CSpinner size="sm" className="me-2" />
            <strong>Salvando {materialiDaConfermare.length} materiali...</strong>
          </div>
        </CToastBody>
      </CToast>
    );
    setToast([saveToast]);
    
    try {
      // Salva tutti i materiali in batch
      const promises = materialiDaConfermare.map(mat => {
        // Usa lo stesso formato della funzione singola
        const conto = conti?.find(c => c.id === mat.materiale.classificazione_suggerita.contoid);
        const branca = mat.materiale.classificazione_suggerita.brancaid ? brancheMap?.[mat.materiale.classificazione_suggerita.brancaid] : null;
        const sottoconto = mat.materiale.classificazione_suggerita.sottocontoid ? sottocontiMap?.[mat.materiale.classificazione_suggerita.sottocontoid] : null;
        
        return materialiService.apiSalvaClassificazioneMateriale({
          codice_articolo: mat.materiale.codice_articolo || '',
          descrizione: mat.materiale.descrizione,
          codice_fornitore: fornitoreSelezionato.codice_riferimento,
          nome_fornitore: fornitoreSelezionato.fornitore_nome,
          contoid: mat.materiale.classificazione_suggerita.contoid,
          contonome: conto?.nome,
          brancaid: mat.materiale.classificazione_suggerita.brancaid,
          brancanome: branca,
          sottocontoid: mat.materiale.classificazione_suggerita.sottocontoid,
          sottocontonome: sottoconto,
          // Dati costo e fattura dal materiale
          data_fattura: mat.materiale.data_fattura,
          costo_unitario: mat.materiale.prezzo_unitario,
          fattura_id: mat.materiale.fattura_id,
          riga_fattura_id: mat.materiale.riga_fattura_id,
          confidence: mat.materiale.classificazione_suggerita.confidence,
          metodo_classificazione: 'batch_conferma_automatica'
        });
      });

      const results = await Promise.all(promises);
      
      // Controlla se tutti i salvataggi sono andati a buon fine
      const salvataggiFalliti = results.filter(result => !result.success);
      
      if (salvataggiFalliti.length === 0) {
        // Tutti salvati con successo - aggiorna stato locale
        setMateriali(prev =>
          prev.map(mat =>
            mat.materiale.classificazione_suggerita.confidence > 80 && mat.stato === 'suggerito'
              ? { ...mat, stato: 'confermato' }
              : mat
          )
        );
        console.log(`✅ Salvati ${materialiDaConfermare.length} materiali con successo`);
      } else {
        console.error(`❌ Falliti ${salvataggiFalliti.length}/${results.length} salvataggi`);
        setError(`Errore nel salvare ${salvataggiFalliti.length} materiali`);
      }
      
    } catch (err: any) {
      console.error('Errore batch salvataggio materiali:', err);
      setError('Errore nel salvare i materiali');
    } finally {
      setLoading(false);
      removeSyncToast(); // Nascondi toast
    }
  };

  // Badge per stato
  const getStatoBadge = (stato: string) => {
    switch (stato) {
      case 'gia_classificato':
        return <CBadge color="success">✅ Già classificato</CBadge>;
      case 'confermato':
        return <CBadge color="success">✓ Confermato</CBadge>;
      case 'modificato':
        return <CBadge color="info">✏️ Modificato</CBadge>;
      case 'in_modifica':
        return <CBadge color="warning">🔧 In modifica</CBadge>;
      case 'da_verificare':
        return <CBadge color="secondary">⚠️ Da verificare</CBadge>;
      case 'suggerito':
        return <CBadge color="primary">💡 Suggerito</CBadge>;
      default:
        return <CBadge color="light">⏳ In attesa</CBadge>;
    }
  };

  if (!fornitoreSelezionato) {
    return (
      <div className="text-center text-muted py-4">
        <CIcon icon={cilMedicalCross} size="xl" className="mb-2" />
        <p>Seleziona un fornitore per visualizzare i materiali</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <CSpinner className="mb-2" />
        <p>Caricamento materiali intelligenti...</p>
      </div>
    );
  }

  if (error) {
    return (
      <CAlert color="danger">
        <strong>Errore:</strong> {error}
      </CAlert>
    );
  }

  if (materiali.length === 0) {
    return (
      <CAlert color="info">
        <CIcon icon={cilMedicalCross} className="me-2" />
        Nessun materiale significativo trovato per questo fornitore.
      </CAlert>
    );
  }

  const materialiVerdi = materiali.filter(m => 
    m.materiale.classificazione_suggerita.confidence > 80 && m.stato === 'suggerito'
  ).length;

  return (
    <CCard>
      <CCardHeader>
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h6 className="mb-0">
              <CIcon icon={cilMedicalCross} className="me-2" />
              Materiali per: {fornitoreSelezionato.fornitore_nome}
            </h6>
            <small className="text-muted">
              {materiali.length} materiali trovati - Filtraggio intelligente applicato
            </small>
          </div>
          <CButton
            color="primary"
            variant="outline"
            size="sm"
            onClick={loadMateriali}
            disabled={loading}
          >
            {loading ? (
              <CSpinner size="sm" className="me-1" />
            ) : (
              <CIcon icon={cilReload} className="me-1" />
            )}
            Refresh
          </CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        {/* Controlli batch */}
        <CRow className="mb-3">
          <CCol>
            <CButton
              color="success"
              size="sm"
              onClick={handleConfermaTuttiVerdi}
              disabled={materialiVerdi === 0 || loading}
            >
              {loading ? (
                <CSpinner size="sm" className="me-1" />
              ) : (
                <CIcon icon={cilCheckCircle} className="me-1" />
              )}
              {loading ? 'Salvando...' : `Conferma Tutti Verdi (${materialiVerdi})`}
            </CButton>
          </CCol>
        </CRow>

        {/* Tabella materiali */}
        <CTable responsive hover>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell 
                style={{ cursor: 'pointer' }}
                onClick={() => handleSort('codice_articolo')}
              >
                Codice Articolo 
                {getSortIcon('codice_articolo') && (
                  <CIcon icon={getSortIcon('codice_articolo')!} className="ms-1" size="sm" />
                )}
              </CTableHeaderCell>
              <CTableHeaderCell 
                style={{ cursor: 'pointer' }}
                onClick={() => handleSort('nome')}
              >
                Nome 
                {getSortIcon('nome') && (
                  <CIcon icon={getSortIcon('nome')!} className="ms-1" size="sm" />
                )}
              </CTableHeaderCell>
              <CTableHeaderCell>Quantità</CTableHeaderCell>
              <CTableHeaderCell>Prezzo</CTableHeaderCell>
              <CTableHeaderCell>Fattura</CTableHeaderCell>
              <CTableHeaderCell>Classificazione</CTableHeaderCell>
              <CTableHeaderCell 
                style={{ cursor: 'pointer' }}
                onClick={() => handleSort('stato')}
              >
                Stato 
                {getSortIcon('stato') && (
                  <CIcon icon={getSortIcon('stato')!} className="ms-1" size="sm" />
                )}
              </CTableHeaderCell>
              <CTableHeaderCell>Azioni</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {sortMateriali(materiali).map((item) => (
              <MaterialeRow
                key={item.id}
                item={item}
                onConferma={() => handleConfermaClassificazione(item.id)}
                onModifica={() => handleModificaClassificazione(item.id)}
                getStatoBadge={getStatoBadge}
                handleSalvaMateriale={handleSalvaMateriale}
              />
            ))}
          </CTableBody>
        </CTable>
      </CCardBody>
    </CCard>
  )
};

// Componente per singola riga materiale con stile ContiSottocontiTab
interface MaterialeRowProps {
  item: MaterialeClassificazione;
  onConferma: () => void;
  onModifica: () => void;
  getStatoBadge: (stato: string) => React.ReactNode;
  handleSalvaMateriale: (
    materialeItem: MaterialeClassificazione, 
    contoid: number, 
    brancaid: number | null, 
    sottocontoid: number | null, 
    tipo: 'solo-conto' | 'conto-branca' | 'completa'
  ) => Promise<void>;
}

const MaterialeRow: React.FC<MaterialeRowProps> = ({
  item,
  onConferma,
  onModifica,
  getStatoBadge,
  handleSalvaMateriale
}) => {
  return (
    <>
      {/* Riga principale materiale con colonne separate */}
      <CTableRow>
        {/* Codice Articolo */}
        <CTableDataCell>
          <div className="fw-bold text-primary">
            {item.materiale.codice_articolo || '-'}
          </div>
        </CTableDataCell>
        
        {/* Nome/Descrizione */}
        <CTableDataCell>
          <div>{item.materiale.descrizione}</div>
        </CTableDataCell>
        
        {/* Quantità */}
        <CTableDataCell>
          <span className="fw-bold">{item.materiale.quantita}</span>
        </CTableDataCell>
        
        {/* Prezzo */}
        <CTableDataCell>
          <div className="fw-bold">€{item.materiale.prezzo_unitario}</div>
          <small className="text-muted">Tot: €{item.materiale.totale_riga}</small>
        </CTableDataCell>
        
        {/* Fattura */}
        <CTableDataCell>
          {item.materiale.data_fattura && (
            <div>
              <div className="fw-bold text-success">{item.materiale.data_fattura}</div>
              <small className="text-muted">{item.materiale.fattura_id}</small>
            </div>
          )}
        </CTableDataCell>
        
        {/* Classificazione */}
        <CTableDataCell>
          <MaterialeClassificazioneStatus 
            classificazione={item.classificazione}
            size="sm"
          />
        </CTableDataCell>
        <CTableDataCell>
          {getStatoBadge(item.stato)}
        </CTableDataCell>
        <CTableDataCell>
          {item.stato === 'suggerito' && (
            <CButton
              color="success"
              size="sm"
              className="me-1"
              onClick={onConferma}
            >
              <CIcon icon={cilCheckCircle} />
            </CButton>
          )}
          {item.stato === 'in_modifica' ? (
            <CButton
              color="secondary"
              size="sm"
              onClick={onModifica}
              title="Annulla modifica"
            >
              <CIcon icon={cilX} />
            </CButton>
          ) : (
            <CButton
              color="warning"
              size="sm"
              onClick={onModifica}
            >
              ✏️
            </CButton>
          )}
        </CTableDataCell>
      </CTableRow>

      {/* Riga inline per modifica classificazione con nuove colonne */}
      {item.stato === 'in_modifica' && (
        <CTableRow className="bg-light">
          {/* Codice Articolo */}
          <CTableDataCell>
            <small className="text-muted">{item.materiale.codice_articolo || '-'}</small>
          </CTableDataCell>
          
          {/* Nome */}
          <CTableDataCell>
            <div>{item.materiale.descrizione}</div>
          </CTableDataCell>
          
          {/* Quantità */}
          <CTableDataCell>
            <small className="text-muted">{item.materiale.quantita}</small>
          </CTableDataCell>
          
          {/* Prezzo */}
          <CTableDataCell>
            <small className="text-muted">€{item.materiale.prezzo_unitario}</small>
          </CTableDataCell>
          
          {/* Fattura */}
          <CTableDataCell>
            {item.materiale.data_fattura && (
              <small className="text-muted">{item.materiale.data_fattura}</small>
            )}
          </CTableDataCell>
          
          {/* Classificazione - Editor */}
          <CTableDataCell>
            <div style={{ minWidth: '300px' }}>
              <ClassificazioneGerarchica
                classificazione={{
                  contoid: item.classificazione.contoid,
                  brancaid: item.classificazione.brancaid,
                  sottocontoid: item.classificazione.sottocontoid
                } as any}
                onSave={(contoid, brancaid, sottocontoid, tipo) => 
                  handleSalvaMateriale(item, contoid, brancaid, sottocontoid, tipo)
                }
              />
            </div>
          </CTableDataCell>
          
          {/* Stato */}
          <CTableDataCell>
            <CBadge color="warning">🔧 In modifica</CBadge>
          </CTableDataCell>
          
          {/* Azioni */}
          <CTableDataCell>
            <CButton
              color="secondary"
              size="sm"
              onClick={onModifica}
              title="Annulla modifica"
            >
              <CIcon icon={cilX} />
            </CButton>
          </CTableDataCell>
        </CTableRow>
      )}
    </>
  );
};


export default MaterialiTable;