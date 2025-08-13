import React from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CAlert
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilChart } from '@coreui/icons';
import type { ClassificazioneCosto } from '@/store/classificazioniStore';
import StatisticheSpeseCard from './StatisticheSpeseCard';
import StatisticheSkeleton from './StatisticheSkeleton';
import { getColoreSerieByIndex } from '../utils/coloriSerie';

interface RaggruppamentoFornitore {
  codice_riferimento: string;
  fornitore_nome: string;
  count: number;
  brancaid: number | null;
  contoid: number | null;
  branca_nome: string | null;
  statistiche?: {
    totale_fatturato: number;
    numero_fatture: number;
    media_fattura: number;
    ultimo_lavoro: string | null;
    percentuale_sul_totale: number;
    totali_mensili: any[];
  };
}

interface TabData {
  classificazioni: ClassificazioneCosto[];
  raggruppamenti: RaggruppamentoFornitore[];
}

interface Props {
  data: TabData;
  isLoading: boolean;
  error: string | null;
  getBrancaById: (id: number | null) => string | undefined;
}

const UtenzeTab: React.FC<Props> = ({ data, isLoading, error, getBrancaById }) => {
  const { raggruppamenti: utenze } = data;

  // Raggruppa utenze per branca
  const utenzePerBranca = React.useMemo(() => {
    const gruppiPerBranca = new Map<string, typeof utenze>();
    
    utenze.forEach(utenza => {
      const nomeBranca = utenza.branca_nome || 'Non classificato';
      if (!gruppiPerBranca.has(nomeBranca)) {
        gruppiPerBranca.set(nomeBranca, []);
      }
      gruppiPerBranca.get(nomeBranca)!.push(utenza);
    });

    const brancheUniche = Array.from(gruppiPerBranca.keys()).sort();
    
    return Array.from(gruppiPerBranca.entries()).map(([nomeBranca, utenze]) => ({
      nomeBranca,
      utenze,
      colore: getColoreSerieByIndex(brancheUniche.indexOf(nomeBranca))
    }));
  }, [utenze, getBrancaById]);


  if (isLoading) {
    return <StatisticheSkeleton count={6} />;
  }

  if (error) {
    return (
      <CAlert color="danger">
        <strong>Errore:</strong> {error}
      </CAlert>
    );
  }

  if (utenze.length === 0) {
    return (
      <CAlert color="info">
        <CIcon icon={cilChart} className="me-2" />
        Nessuna utenza classificata trovata.
      </CAlert>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h6 className="text-muted">
          <CIcon icon={cilChart} className="me-2" />
          {utenze.length} utenze trovate in {utenzePerBranca.length} categorie
        </h6>
      </div>

      {utenzePerBranca.map((gruppo, groupIndex) => (
        <div key={groupIndex} className="mb-5">
          {/* Header della categoria */}
          <div className="mb-3">
            <h5 
              className="text-white px-3 py-2 rounded"
              style={{ 
                backgroundColor: gruppo.colore,
                display: 'inline-block'
              }}
            >
              {gruppo.nomeBranca} ({gruppo.utenze.length})
            </h5>
          </div>
          
          {/* Card delle utenze di questa categoria */}
          <CRow>
            {gruppo.utenze.map((utenza, index) => (
              <CCol key={index} md={3} className="mb-4">
                <CCard className="h-100">
                  <CCardHeader
                    style={{
                      backgroundColor: gruppo.colore,
                      color: "#fff",
                      fontWeight: "bold", 
                      height: 80
                    }}
                  >
                    <CIcon icon={cilChart} size="xl" className="text-white me-3" />
                    {utenza.fornitore_nome}
                  </CCardHeader>
                  <CCardBody>
                    <StatisticheSpeseCard 
                      fornitore={{
                        codice_riferimento: utenza.codice_riferimento,
                        fornitore_nome: utenza.fornitore_nome
                      }}
                      statistiche={utenza.statistiche}
                    />
                  </CCardBody>
                </CCard>
              </CCol>
            ))}
          </CRow>
        </div>
      ))}
    </div>
  );
};

export default UtenzeTab;