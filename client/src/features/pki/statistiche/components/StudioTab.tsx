import React from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CRow,
  CCol,
  CSpinner,
  CAlert
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilBuilding, cilUser } from '@coreui/icons';
import { useClassificazioni } from '@/store/classificazioniStore';
import { useContiStore } from '@/store/contiStore';
import StatisticheLavoroCard from './StatisticheLavoroCard';
import { getColoreSerieByIndex } from '../utils/coloriSerie';

const StudioTab: React.FC = () => {
  const { classificazioni, isLoading, error } = useClassificazioni('STUDIO');
  const { getBrancaById, loadBranche } = useContiStore();


  // Raggruppa per codice_riferimento (fornitore)
  const consulenti = React.useMemo(() => {
    const gruppi = new Map<
      string,
      {
        codice_riferimento: string;
        fornitore_nome: string;
        count: number;
        brancaid: number | null;
        contoid: number | null;
      }
    >();

    classificazioni.forEach((c) => {
      if (!gruppi.has(c.codice_riferimento)) {
        gruppi.set(c.codice_riferimento, {
          codice_riferimento: c.codice_riferimento,
          fornitore_nome: c.fornitore_nome || c.codice_riferimento,
          count: 0,
          brancaid: c.brancaid,
          contoid: c.contoid,
        });
      }
      gruppi.get(c.codice_riferimento)!.count += 1;
    });

    return Array.from(gruppi.values());
  }, [classificazioni]);

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

  // Carica le branche per tutti i conti dei consulenti
  React.useEffect(() => {
    const contiUniques = new Set<number>();
    consulenti.forEach(c => {
      if (c.contoid) contiUniques.add(c.contoid);
    });
    
    contiUniques.forEach(contoid => {
      loadBranche(contoid);
    });
  }, [consulenti, loadBranche]);

  if (isLoading) {
    return (
      <div className="text-center p-4">
        <CSpinner />
        <div className="mt-2">Caricamento consulenti...</div>
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
                    <StatisticheLavoroCard 
                      collaboratore={{
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