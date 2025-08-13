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
import { cilSpeedometer, cilUser } from '@coreui/icons';
import { useClassificazioni } from '@/store/classificazioniStore';
import { useContiStore } from '@/store/contiStore';
import StatisticheLavoroCard from './StatisticheLavoroCard';
import { getColoreSerieByIndex } from '../utils/coloriSerie';

const AutostradaTab: React.FC = () => {
  const { classificazioni, isLoading, error } = useClassificazioni('AUTOSTRADA');
  const { getBrancaById, loadBranche } = useContiStore();

  // Raggruppa per codice_riferimento (fornitore)
  const fornitori = React.useMemo(() => {
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

  // Raggruppa fornitori per branca
  const fornitoriPerBranca = React.useMemo(() => {
    const gruppiPerBranca = new Map<string, typeof fornitori>();
    
    fornitori.forEach(fornitore => {
      const nomeBranca = getBrancaById(fornitore.brancaid) || 'Non classificato';
      if (!gruppiPerBranca.has(nomeBranca)) {
        gruppiPerBranca.set(nomeBranca, []);
      }
      gruppiPerBranca.get(nomeBranca)!.push(fornitore);
    });

    const brancheUniche = Array.from(gruppiPerBranca.keys()).sort();
    
    return Array.from(gruppiPerBranca.entries()).map(([nomeBranca, fornitori]) => ({
      nomeBranca,
      fornitori,
      colore: getColoreSerieByIndex(brancheUniche.indexOf(nomeBranca))
    }));
  }, [fornitori, getBrancaById]);

  // Carica le branche per tutti i conti dei fornitori
  React.useEffect(() => {
    const contiUniques = new Set<number>();
    fornitori.forEach(f => {
      if (f.contoid) contiUniques.add(f.contoid);
    });
    
    contiUniques.forEach(contoid => {
      loadBranche(contoid);
    });
  }, [fornitori, loadBranche]);

  if (isLoading) {
    return (
      <div className="text-center p-4">
        <CSpinner />
        <div className="mt-2">Caricamento fornitori autostrada...</div>
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

  if (fornitori.length === 0) {
    return (
      <CAlert color="info">
        <CIcon icon={cilSpeedometer} className="me-2" />
        Nessun fornitore autostrada classificato trovato.
      </CAlert>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h6 className="text-muted">
          <CIcon icon={cilSpeedometer} className="me-2" />
          {fornitori.length} fornitori autostrada trovati in {fornitoriPerBranca.length} categorie
        </h6>
      </div>

      {fornitoriPerBranca.map((gruppo, groupIndex) => (
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
              {gruppo.nomeBranca} ({gruppo.fornitori.length})
            </h5>
          </div>
          
          {/* Card dei fornitori di questa categoria */}
          <CRow>
            {gruppo.fornitori.map((fornitore, index) => (
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
                    <CIcon icon={cilSpeedometer} size="xl" className="text-white me-3" />
                    {fornitore.fornitore_nome}
                  </CCardHeader>
                  <CCardBody>
                    <StatisticheLavoroCard 
                      collaboratore={{
                        codice_riferimento: fornitore.codice_riferimento,
                        fornitore_nome: fornitore.fornitore_nome
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

export default AutostradaTab;