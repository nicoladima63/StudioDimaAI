import React, { useState } from 'react';
import {
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CButton,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CForm,
  CFormLabel,
  CFormInput,
  CFormSelect,
  CRow,
  CCol,
} from '@coreui/react';
import PageLayout from '@/components/layout/PageLayout';
import RicettePaziente from '../components/RicettePaziente';
import RicettaAvanzata from '../components/RicettaAvanzata';
import RicetteTSPaziente from '../components/RicetteTSPaziente';
import PazientiSelect from '@/components/selects/PazientiSelect';
import { usePazientiStore, type Paziente } from '@/store/pazienti.store';

const datiMedico = {
  regione: '090',
  regioneOrdine: 'Firenze',
  ambito: 'Odontoiatria',
  specializzazione: 'F',
  iscrizione: '591',
  indirizzo: 'Via Michelangelo Buonarroti,15',
  telefono: '0574712060',
  cap: '51031',
  citta: 'Agliana',
  provincia: 'PT',
  asl: '109',
  cfMedico: 'DMRNCL63S21D612I',
};

const emptyForm = {
  cognome: '',
  nome: '',
  codice_fiscale: '',
  data_nascita: '',
  sesso: '',
  indirizzo: '',
  citta: '',
  provincia: '',
  cap: '',
  telefono: '',
  cellulare: '',
  email: '',
};

const RicettaElettronicaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('compila');
  const [pazienteSelezionato, setPazienteSelezionato] = useState<Paziente | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const { loadAllPazienti } = usePazientiStore();

  React.useEffect(() => {
    loadAllPazienti();
  }, [loadAllPazienti]);

  const handleFormChange = (field: keyof typeof emptyForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (formError) setFormError('');
  };

  const handleSalvaNuovoPaziente = () => {
    if (!form.cognome.trim()) {
      setFormError('Il cognome è obbligatorio');
      return;
    }
    if (!form.codice_fiscale.trim()) {
      setFormError('Il codice fiscale è obbligatorio');
      return;
    }

    const nuovoPaziente: Paziente = {
      id: `NUOVO_${Date.now()}`,
      nome: `${form.cognome.trim()} ${form.nome.trim()}`.trim(),
      cognome: form.cognome.trim(),
      codice_fiscale: form.codice_fiscale.toUpperCase().trim(),
      data_nascita: form.data_nascita || undefined,
      sesso: (form.sesso as 'M' | 'F' | 'N') || undefined,
      indirizzo: form.indirizzo || undefined,
      citta: form.citta || undefined,
      provincia: form.provincia || undefined,
      cap: form.cap || undefined,
      telefono: form.telefono || undefined,
      cellulare: form.cellulare || undefined,
      email: form.email || undefined,
    };

    setPazienteSelezionato(nuovoPaziente);
    setShowModal(false);
    setForm(emptyForm);
    setFormError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setForm(emptyForm);
    setFormError('');
  };

  return (
    <PageLayout>
      <PageLayout.Header title='Ricetta Elettronica' />
      <PageLayout.ContentHeader>
        <CRow className='g-2 align-items-center'>
          <CCol>
            <PazientiSelect
              value={pazienteSelezionato?.id || null}
              onChange={setPazienteSelezionato}
              placeholder='Digita nome paziente...'
              searchable={true}
              clearable={true}
              hideDetails={true}
            />
          </CCol>
          <CCol xs='auto'>
            <CButton color='secondary' onClick={() => setShowModal(true)}>
              + Nuovo Paziente
            </CButton>
          </CCol>
          {pazienteSelezionato && (
            <CCol xs={12} className='pt-1'>
              <small className='text-success fw-semibold'>{pazienteSelezionato.nome}</small>
              {pazienteSelezionato.codice_fiscale && (
                <small className='text-muted ms-2'>CF: {pazienteSelezionato.codice_fiscale}</small>
              )}
            </CCol>
          )}
        </CRow>
      </PageLayout.ContentHeader>

      <PageLayout.ContentBody>
        <CNav variant='tabs' role='tablist'>
          <CNavItem>
            <CNavLink active={activeTab === 'compila'} onClick={() => setActiveTab('compila')} role='tab'>
              Compila Ricetta
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink active={activeTab === 'sistema-ts'} onClick={() => setActiveTab('sistema-ts')} role='tab'>
              List Ricette TS
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink active={activeTab === 'database'} onClick={() => setActiveTab('database')} role='tab'>
              List Ricette DB
            </CNavLink>
          </CNavItem>
        </CNav>
        <CTabContent className='mt-4'>
          <CTabPane visible={activeTab === 'compila'} role='tabpanel'>
            <RicettaAvanzata datiMedico={datiMedico} pazienteSelezionato={pazienteSelezionato} />
          </CTabPane>
          <CTabPane visible={activeTab === 'sistema-ts'} role='tabpanel'>
            <RicetteTSPaziente pazienteSelezionato={pazienteSelezionato} />
          </CTabPane>
          <CTabPane visible={activeTab === 'database'} role='tabpanel'>
            <RicettePaziente cfPazienteIniziale={pazienteSelezionato?.codice_fiscale?.trim() || ''} />
          </CTabPane>
        </CTabContent>
      </PageLayout.ContentBody>

      <CModal visible={showModal} onClose={handleCloseModal} size='lg'>
        <CModalHeader>
          <CModalTitle>Nuovo Paziente</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            {formError && (
              <div className='alert alert-danger py-2 mb-3'>{formError}</div>
            )}
            <CRow className='g-3'>
              <CCol md={6}>
                <CFormLabel>Cognome *</CFormLabel>
                <CFormInput
                  value={form.cognome}
                  onChange={e => handleFormChange('cognome', e.target.value)}
                  placeholder='Rossi'
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Nome</CFormLabel>
                <CFormInput
                  value={form.nome}
                  onChange={e => handleFormChange('nome', e.target.value)}
                  placeholder='Mario'
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Codice Fiscale *</CFormLabel>
                <CFormInput
                  value={form.codice_fiscale}
                  onChange={e => handleFormChange('codice_fiscale', e.target.value.toUpperCase())}
                  placeholder='RSSMRA80A01H501U'
                  style={{ textTransform: 'uppercase' }}
                />
              </CCol>
              <CCol md={3}>
                <CFormLabel>Data di Nascita</CFormLabel>
                <CFormInput
                  type='date'
                  value={form.data_nascita}
                  onChange={e => handleFormChange('data_nascita', e.target.value)}
                />
              </CCol>
              <CCol md={3}>
                <CFormLabel>Sesso</CFormLabel>
                <CFormSelect
                  value={form.sesso}
                  onChange={e => handleFormChange('sesso', e.target.value)}
                >
                  <option value=''>--</option>
                  <option value='M'>M</option>
                  <option value='F'>F</option>
                </CFormSelect>
              </CCol>
              <CCol md={8}>
                <CFormLabel>Indirizzo</CFormLabel>
                <CFormInput
                  value={form.indirizzo}
                  onChange={e => handleFormChange('indirizzo', e.target.value)}
                  placeholder='Via Roma, 1'
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel>CAP</CFormLabel>
                <CFormInput
                  value={form.cap}
                  onChange={e => handleFormChange('cap', e.target.value)}
                  placeholder='00100'
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Città</CFormLabel>
                <CFormInput
                  value={form.citta}
                  onChange={e => handleFormChange('citta', e.target.value)}
                  placeholder='Roma'
                />
              </CCol>
              <CCol md={2}>
                <CFormLabel>Prov.</CFormLabel>
                <CFormInput
                  value={form.provincia}
                  onChange={e => handleFormChange('provincia', e.target.value.toUpperCase())}
                  placeholder='RM'
                  maxLength={2}
                  style={{ textTransform: 'uppercase' }}
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel>Telefono</CFormLabel>
                <CFormInput
                  value={form.telefono}
                  onChange={e => handleFormChange('telefono', e.target.value)}
                  placeholder='06 12345678'
                />
              </CCol>
              <CCol md={4}>
                <CFormLabel>Cellulare</CFormLabel>
                <CFormInput
                  value={form.cellulare}
                  onChange={e => handleFormChange('cellulare', e.target.value)}
                  placeholder='333 1234567'
                />
              </CCol>
              <CCol md={8}>
                <CFormLabel>Email</CFormLabel>
                <CFormInput
                  type='email'
                  value={form.email}
                  onChange={e => handleFormChange('email', e.target.value)}
                  placeholder='mario.rossi@email.it'
                />
              </CCol>
            </CRow>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' onClick={handleCloseModal}>
            Annulla
          </CButton>
          <CButton color='primary' onClick={handleSalvaNuovoPaziente}>
            Usa questo paziente
          </CButton>
        </CModalFooter>
      </CModal>
    </PageLayout>
  );
};

export default RicettaElettronicaPage;
