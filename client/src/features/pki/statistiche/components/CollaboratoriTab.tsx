import React from "react";
import {
  CCard,
  CCardBody,
  CRow,
  CCol,
  CAlert,
  CCardHeader,
} from "@coreui/react";
import CIcon from "@coreui/icons-react";
import { cilPeople } from "@coreui/icons";
import type { ClassificazioneCosto } from "@/store/classificazioniStore";
import StatisticheSpeseCard from "./StatisticheSpeseCard";
import StatisticheSkeleton from "./StatisticheSkeleton";

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

const CollaboratoriTab: React.FC<Props> = ({ data, isLoading, error, getBrancaById }) => {
  const { raggruppamenti: fornitori } = data;


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

    return Array.from(gruppiPerBranca.entries()).map(([nomeBranca, fornitori]) => ({
      nomeBranca,
      fornitori,
      colore: getColoreCollaboratore(fornitori[0]?.brancaid || null)
    }));
  }, [fornitori, getBrancaById, getColoreCollaboratore]);


  if (isLoading) {
    return <StatisticheSkeleton count={8} />;
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
        <CIcon icon={cilPeople} className="me-2" />
        Nessun collaboratore classificato trovato.
      </CAlert>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h6 className="text-muted">
          <CIcon icon={cilPeople} className="me-2" />
          {fornitori.length} collaboratori trovati in {fornitoriPerBranca.length} branche
        </h6>
      </div>

      {fornitoriPerBranca.map((gruppo, groupIndex) => (
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
              {gruppo.nomeBranca} ({gruppo.fornitori.length})
            </h5>
          </div>
          
          {/* Card dei collaboratori di questa branca */}
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
                    <CIcon icon={cilPeople} size="xl" className="text-white me-3" />
                    {fornitore.fornitore_nome}
                  </CCardHeader>
                  <CCardBody>
                    <StatisticheSpeseCard
                      fornitore={{
                        codice_riferimento: fornitore.codice_riferimento,
                        fornitore_nome: fornitore.fornitore_nome,
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
