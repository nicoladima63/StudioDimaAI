import PageLayout from "../../components/layout/PageLayout"
import { CButton } from "@coreui/react"
import SelectPeriodo from "../../components/selects/SelectPeriodo"
import React, { useState } from "react"


  

const GestioneMaterialiPage = () => {
     
  // Mock dati per esempio
  const anniDisponibili = [2025, 2024, 2023];
  const [valori, setValori] = useState<{ anni: number[]; tipo: string; sottoperiodo: string }>({ anni: [2025], tipo: "mese", sottoperiodo: "" });

  return (
    <PageLayout>
      <PageLayout.Header
        title="titolo della pagina"
        headerAction={<CButton color="primary">Aggiungi</CButton>}
        
      />

      <PageLayout.Content>
                <SelectPeriodo
          anniDisponibili={anniDisponibili}
          onChange={setValori}
          defaultAnni={[2025]}
        />
        <div className="mt-3">
          <strong>Selezionato:</strong> Anni: {valori.anni.join(", ") || 'Nessuno'}, Tipo: {valori.tipo}, Sottoperiodo: {valori.sottoperiodo || 'Tutto'}
        </div>

      </PageLayout.Content>

      <PageLayout.Footer text="© 2025 Studio Dima" />
    </PageLayout>
  )
}

export default GestioneMaterialiPage
