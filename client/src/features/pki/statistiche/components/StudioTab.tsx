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
import { cilBuilding } from '@coreui/icons';
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

const StudioTab: React.FC<Props> = ({ data, isLoading, error, getBrancaById }) => {
  const { raggruppamenti: consulenti } = data;

  // Raggruppa consulenti per branca
  const consulentiPerBranca = React.useMemo(() => {
    const gruppiPerBranca = new Map<string, typeof consulenti>();
    
    consulenti.forEach(consulente => {
      const nomeBranca = getBrancaById(consulente.brancaid) || 'Non classificato';
      if (!gruppiPerBranca.has(nomeBranca)) {
        gruppiPerBranca.set(nomeBranca, []);
      }
      gruppiPerBranca.get(nomeBranca)!.push(consulente);
    });

    const brancheUniche = Array.from(gruppiPerBranca.keys()).sort();
    
    return Array.from(gruppiPerBranca.entries()).map(([nomeBranca, consulenti]) => ({
      nomeBranca,
      consulenti,
      colore: getColoreSerieByIndex(brancheUniche.indexOf(nomeBranca))
    }));
  }, [consulenti, getBrancaById]);


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

  if (consulenti.length === 0) {
    return (
      <CAlert color="info">
        <CIcon icon={cilBuilding} className="me-2" />
        Nessun consulente classificato trovato.
      </CAlert>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h6 className="text-muted">
          <CIcon icon={cilBuilding} className="me-2" />
          {consulenti.length} consulenti trovati in {consulentiPerBranca.length} categorie
        </h6>
      </div>

      {consulentiPerBranca.map((gruppo, groupIndex) => (
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
              {gruppo.nomeBranca} ({gruppo.consulenti.length})
            </h5>
          </div>
          
          {/* Card dei consulenti di questa categoria */}
          <CRow>
            {gruppo.consulenti.map((consulente, index) => (
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
                    <CIcon icon={cilBuilding} size="xl" className="text-white me-3" />
                    {consulente.fornitore_nome}
                  </CCardHeader>
                  <CCardBody>
                    <StatisticheSpeseCard 
                      fornitore={{
                        codice_riferimento: consulente.codice_riferimento,
                        fornitore_nome: consulente.fornitore_nome
                      }}
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

export default StudioTab;