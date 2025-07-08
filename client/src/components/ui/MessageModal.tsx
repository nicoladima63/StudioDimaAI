import React, { useState, useEffect } from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CFormTextarea,
  CFormLabel,
  CSpinner
} from '@coreui/react';

interface MessageModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (testo: string) => void;
  tipo: 'richiamo' | 'promemoria';
  messaggio: string;
  loading?: boolean;
}

const placeholders = [
  { key: '{nomepaziente}', desc: 'nome e cognome del paziente' },
  { key: '{tiporichiamo}', desc: 'descrizione del richiamo' },
  { key: '{dataappuntamento}', desc: "data dell'appuntamento/ricordo" },
];

const MessageModal: React.FC<MessageModalProps> = ({ open, onClose, onSave, tipo, messaggio, loading }) => {
  const [edit, setEdit] = useState(false);
  const [testo, setTesto] = useState(messaggio);

  useEffect(() => {
    setTesto(messaggio);
    setEdit(false);
  }, [messaggio, open]);

  return (
    <CModal visible={open} onClose={onClose} alignment="center">
      <CModalHeader>
        <CModalTitle>Messaggio {tipo === 'richiamo' ? 'di richiamo' : 'promemoria'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CFormLabel>Testo del messaggio</CFormLabel>
        <CFormTextarea
          rows={5}
          value={testo}
          onChange={e => setTesto(e.target.value)}
          readOnly={!edit}
          style={{ fontFamily: 'monospace' }}
        />
        <div className="mt-3 small text-muted">
          Puoi usare i seguenti segnaposto:<br />
          {placeholders.map(ph => (
            <div key={ph.key}><b>{ph.key}</b> &rarr; {ph.desc}</div>
          ))}
        </div>
      </CModalBody>
      <CModalFooter>
        {!edit ? (
          <CButton color="secondary" onClick={() => setEdit(true)}>
            Modifica
          </CButton>
        ) : (
          <>
            <CButton color="success" onClick={() => onSave(testo)} disabled={loading}>
              {loading ? <CSpinner size="sm" /> : 'Salva'}
            </CButton>
            <CButton color="light" onClick={() => { setTesto(messaggio); setEdit(false); }}>
              Annulla
            </CButton>
          </>
        )}
        <CButton color="dark" variant="outline" onClick={onClose}>Chiudi</CButton>
      </CModalFooter>
    </CModal>
  );
};

export default MessageModal; 