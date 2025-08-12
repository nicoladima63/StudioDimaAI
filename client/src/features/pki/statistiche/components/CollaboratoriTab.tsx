import React from "react";
import {
  CCard,
  CCardBody,
  CRow,
  CCol,
  CSpinner,
  CAlert,
  CCardHeader,
} from "@coreui/react";
import CIcon from "@coreui/icons-react";
import { cilPeople, cilUser } from "@coreui/icons";
import { useClassificazioni } from "@/store/classificazioniStore";
import { useContiStore } from "@/store/contiStore";
import StatisticheLavoroCard from "./StatisticheLavoroCard";

// Mappatura tipi collaboratori con colori degli appuntamenti
const COLORI_COLLABORATORI = {
  Chirurgia: "#FF0000", // H - Rosso
  Ortodonzia: "#FFC0CB", // O - Rosa
  Igiene: "#800080", // I - Viola
  Conservativa: "#00BFFF", // C - Azzurro
  Endodonzia: "#808080", // E - Grigio
  Laboratori: "#008000", // P - Verde
  Implantologia: "#FF00FF", // L - Magenta
  Parodontologia: "#FFFF00", // R - Giallo
  Gnatologia: "#C8A2C8", // U - Viola chiaro
  default: "#ADD8E6", // S - Azzurro chiaro
};

const CollaboratoriTab: React.FC = () => {
  const { classificazioni, isLoading, error } =
    useClassificazioni("COLLABORATORI");
  const { getBrancaById, loadBranche } = useContiStore();

  // Raggruppa per codice_riferimento (fornitore)
  const collaboratori = React.useMemo(() => {
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

  // Funzione per ottenere il colore in base al brancaid
  const getColoreCollaboratore = React.useCallback((brancaid: number | null): string => {
    // DEBUG: Mostra info nella console
    if (brancaid) {
      const nomeBranca = getBrancaById(brancaid);
    }
    
    if (!brancaid) return COLORI_COLLABORATORI.default;

    const nomeBranca = getBrancaById(brancaid);
    if (!nomeBranca) return COLORI_COLLABORATORI.default;

    // Match case-insensitive
    const nomeBrancaLower = nomeBranca.toLowerCase();
    for (const [key, color] of Object.entries(COLORI_COLLABORATORI)) {
      if (key.toLowerCase() === nomeBrancaLower) {
        return color;
      }
    }
    return COLORI_COLLABORATORI.default;
  }, [getBrancaById]);

  // Raggruppa collaboratori per branca
  const collaboratoriPerBranca = React.useMemo(() => {
    const gruppiPerBranca = new Map<string, typeof collaboratori>();
    
    collaboratori.forEach(collab => {
      const nomeBranca = getBrancaById(collab.brancaid) || 'Non classificato';
      if (!gruppiPerBranca.has(nomeBranca)) {
        gruppiPerBranca.set(nomeBranca, []);
      }
      gruppiPerBranca.get(nomeBranca)!.push(collab);
    });

    return Array.from(gruppiPerBranca.entries()).map(([nomeBranca, collaboratori]) => ({
      nomeBranca,
      collaboratori,
      colore: getColoreCollaboratore(collaboratori[0]?.brancaid || null)
    }));
  }, [collaboratori, getBrancaById, getColoreCollaboratore]);

  // Carica le branche per tutti i conti dei collaboratori
  React.useEffect(() => {
    const contiUniques = new Set<number>();
    collaboratori.forEach(c => {
      if (c.contoid) contiUniques.add(c.contoid);
    });
    
    contiUniques.forEach(contoid => {
      loadBranche(contoid);
    });
  }, [collaboratori, loadBranche]);

  if (isLoading) {
    return (
      <div className="text-center p-4">
        <CSpinner />
        <div className="mt-2">Caricamento collaboratori...</div>
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

  if (collaboratori.length === 0) {
    return (
      <CAlert color="info">
        <CIcon icon={cilUser} className="me-2" />
        Nessun collaboratore classificato trovato.
      </CAlert>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h6 className="text-muted">
          <CIcon icon={cilPeople} className="me-2" />
          {collaboratori.length} collaboratori trovati in {collaboratoriPerBranca.length} branche
        </h6>
      </div>

      {collaboratoriPerBranca.map((gruppo, groupIndex) => (
        <div key={groupIndex} className="mb-5">
          {/* Header della branca */}
          <div className="mb-3">
            <h5 
              className="text-white px-3 py-2 rounded"
              style={{ 
                backgroundColor: gruppo.colore,
                display: 'inline-block'
              }}
            >
              {gruppo.nomeBranca} ({gruppo.collaboratori.length})
            </h5>
          </div>
          
          {/* Card dei collaboratori di questa branca */}
          <CRow>
            {gruppo.collaboratori.map((collaboratore, index) => (
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
                    <CIcon icon={cilUser} size="xl" className="text-white me-3" />
                    {collaboratore.fornitore_nome}
                  </CCardHeader>
                  <CCardBody>
                    <StatisticheLavoroCard
                      collaboratore={{
                        codice_riferimento: collaboratore.codice_riferimento,
                        fornitore_nome: collaboratore.fornitore_nome,
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

export default CollaboratoriTab;
