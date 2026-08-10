import React from 'react'
import {
  CCard,
  CCardBody,
  CButton,
} from '@coreui/react'

import PageTemplate from '@/components/layout/PageTemplate'

const PageTemplateTest: React.FC = () => {
  return (
    <PageTemplate
      title="Titolo della pagina PageTemplate"

      loading={false}
      error={null}

      onRefresh={() => console.log('Refresh')}

      headerActions={
        <CButton color="success">
          Nuovo
        </CButton>
      }

      filters={
        <>
          <h5>Filtri</h5>
          <p className="text-muted mb-0">
            Qui andranno Select, Input, DatePicker...
          </p>
        </>
      }

      stats={
        <>
          <h5>Statistiche</h5>
          <div>
            Record: <strong>123</strong>
          </div>
        </>
      }

      sidePanel={
        <>
          <h5>Informazioni</h5>
          <p className="mb-0">
            Area libera.
          </p>
        </>
      }

      footer="Footer della pagina PageTemplate"
    >
<CCard>
  <CCardBody>

    <h4>Component Gallery</h4>

    <p className="text-muted mt-2">
      Modelli base utilizzabili nelle nuove pagine.
    </p>


    <hr />

    {/* CARD */}
    <h5 className='mt-2 mb-1'>Card</h5>

    <CCard className="mb-3">
      <CCardBody>
        <h6>Titolo Card</h6>
        <p className="mb-0">
          Contenuto della card.
        </p>
      </CCardBody>
    </CCard>


    <hr />


    {/* TABLE */}
    <h5 className='mt-2 mb-1'>Tabella</h5>

    <table className="table table-striped">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Stato</th>
          <th>Valore</th>
        </tr>
      </thead>

      <tbody>
        <tr>
          <td>Elemento 1</td>
          <td>Attivo</td>
          <td>100</td>
        </tr>

        <tr>
          <td>Elemento 2</td>
          <td>Chiuso</td>
          <td>200</td>
        </tr>
      </tbody>
    </table>


    <hr />


    {/* FORM */}
    <h5 className='mt-2 mb-1'>Form</h5>

    <div className="mb-3">

      <label className="form-label">
        Nome
      </label>

      <input
        className="form-control"
        placeholder="Inserisci valore"
      />

    </div>

    <CButton className="btn btn-primary" size='sm'>
      Salva
    </CButton>


    <hr className='mt-3' mb-3
     />


    {/* ACCORDION */}
    <h5 className='mt-2 mb-1'>Accordion</h5>

    <details>
      <summary>
        Apri sezione
      </summary>

      <p className="mt-2 mb-0">
        Contenuto nascosto dell'accordion.
      </p>

    </details>


    <hr />


    {/* BADGE */}
    <h5 className='mt-2 mb-1'>Badge / Stato</h5>

    <span className="badge bg-success">
      Attivo
    </span>


    <hr />


    {/* ALERT */}
    <h5 className='mt-2 mb-1'>Alert</h5>

    <div className="alert alert-info p-2" role="alert">
      Messaggio informativo.
    </div>


    <hr />


    {/* BUTTONS */}
    <h5 className='mt-2 mb-1'>Azioni</h5>

    <CButton color="primary" className="me-2" size='sm'>
      Salva
    </CButton>

    <CButton color="danger" size='sm'>
      Elimina
    </CButton>


  </CCardBody>
</CCard>      
    </PageTemplate>
  )
}

export default PageTemplateTest