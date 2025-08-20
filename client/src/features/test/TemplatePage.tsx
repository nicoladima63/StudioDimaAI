import React, { useState } from "react";
import PageLayout from "../../components/layout/PageLayout";
import SelectPeriodo from "../../components/selects/SelectPeriodo";
import { CButton, CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell } from "@coreui/react";

const TemplatePage: React.FC = () => {
  // Esempio mock dati
  const anniDisponibili = [2025, 2024, 2023];
  const [periodo, setPeriodo] = useState({ anni: [2025], tipo: "mese", sottoperiodo: "" });

  return (
    <PageLayout>
      <PageLayout.Header
        title="Titolo della pagina"
        headerAction={<CButton color="primary">Azione</CButton>}
      />

      <PageLayout.ContentHeader>
        <SelectPeriodo
          anniDisponibili={anniDisponibili}
          onChange={setPeriodo}
          defaultAnni={[2025]}
        />
      </PageLayout.ContentHeader>

      <PageLayout.ContentBody>
        {/* Esempio tabella */}
        <CTable striped hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Colonna 1</CTableHeaderCell>
              <CTableHeaderCell>Colonna 2</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            <CTableRow>
              <CTableDataCell>Valore 1</CTableDataCell>
              <CTableDataCell>Valore 2</CTableDataCell>
            </CTableRow>
          </CTableBody>
        </CTable>
      </PageLayout.ContentBody>

      <PageLayout.Footer text="© 2025 Studio Dima" />
    </PageLayout>
  );
};

export default TemplatePage;
