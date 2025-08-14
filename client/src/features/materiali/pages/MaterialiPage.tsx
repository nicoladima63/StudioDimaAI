import React, { useState, useEffect } from 'react';
import { CCol, CRow, CButton } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilArrowCircleTop } from '@coreui/icons';
import { Card } from '@/components/ui';
import SelectFornitore from '../components/SelectFornitore';
import MaterialiTable from '../components/MaterialiTable';
import type { FornitoreItem } from '../types';

interface MaterialiState {
  fornitoreSelezionato: FornitoreItem | null;
  contoid: number | null;
}

const MaterialiPage: React.FC = () => {
  const [state, setState] = useState<MaterialiState>({
    fornitoreSelezionato: null,
    contoid: null
  });
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleFornitoreChange = (fornitore: FornitoreItem | null) => {
    setState(prev => ({
      ...prev,
      fornitoreSelezionato: fornitore
    }));
  };

  const handleContoChange = (contoid: number | null) => {
    setState(prev => ({
      ...prev,
      contoid,
      fornitoreSelezionato: null // Reset fornitore quando cambia il conto
    }));
  };

  // Gestione scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setShowScrollTop(scrollTop > 300); // Mostra dopo 300px di scroll
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Funzione scroll to top
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <div>
      <CRow>
        <CCol xs={12}>
          <Card title="Classificazione Materiali Dentali">
            <p className="text-muted mb-4">
              Gestione classificazioni materiali per analisi storica e pianificazione acquisti
            </p>
            
            {/* Selettore Fornitore */}
            <div className="mb-4">
              <SelectFornitore
                fornitoreSelezionato={state.fornitoreSelezionato}
                onFornitoreChange={handleFornitoreChange}
                contoid={state.contoid}
                onContoChange={handleContoChange}
              />
            </div>
            
            {/* MaterialiTable con classificazione intelligente */}
            <MaterialiTable fornitoreSelezionato={state.fornitoreSelezionato} />
          </Card>
        </CCol>
      </CRow>
      
      {/* Scroll to Top Button */}
      {showScrollTop && (
        <div 
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000
          }}
        >
          <CButton
            color="primary"
            size="lg"
            onClick={scrollToTop}
            className="rounded-circle shadow-lg"
            style={{
              width: '50px',
              height: '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Torna all'inizio"
          >
            <CIcon icon={cilArrowCircleTop} size="lg" />
          </CButton>
        </div>
      )}
    </div>
  );
};

export default MaterialiPage;