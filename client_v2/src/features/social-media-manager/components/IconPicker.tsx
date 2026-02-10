/**
 * IconPicker Component - Selettore visuale icone CoreUI
 * Mostra tutte le icone disponibili in un popup stile emoji picker
 */

import React, { useState, useMemo } from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CFormInput,
  CRow,
  CCol,
  CButton
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import * as icons from '@coreui/icons';

interface IconPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (iconName: string) => void;
  selectedIcon?: string;
}

const IconPicker: React.FC<IconPickerProps> = ({
  visible,
  onClose,
  onSelect,
  selectedIcon
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Estrai tutte le icone disponibili da @coreui/icons
  const availableIcons = useMemo(() => {
    const iconList: Array<{ name: string; icon: any }> = [];

    // Filtra solo le icone (esclude altri export)
    Object.entries(icons).forEach(([name, icon]) => {
      // Includi solo icone che iniziano con 'cil' o 'cib' o 'cif'
      if (
        name.startsWith('cil') ||
        name.startsWith('cib') ||
        name.startsWith('cif') ||
        name.startsWith('cis')
      ) {
        iconList.push({ name, icon });
      }
    });

    return iconList.sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Filtra icone in base alla ricerca
  const filteredIcons = useMemo(() => {
    if (!searchTerm.trim()) {
      return availableIcons;
    }

    const term = searchTerm.toLowerCase();
    return availableIcons.filter((item) =>
      item.name.toLowerCase().includes(term)
    );
  }, [availableIcons, searchTerm]);

  const handleSelectIcon = (iconName: string) => {
    onSelect(iconName);
    onClose();
  };

  return (
    <CModal visible={visible} onClose={onClose} size="xl" scrollable>
      <CModalHeader>
        <CModalTitle>Seleziona Icona CoreUI</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {/* Ricerca */}
        <div className="mb-3">
          <CFormInput
            type="text"
            placeholder="Cerca icona... (es: star, heart, user)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
          <small className="text-muted">
            {filteredIcons.length} icone trovate
          </small>
        </div>

        {/* Griglia Icone */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '8px',
            maxHeight: '500px',
            overflowY: 'auto'
          }}
        >
          {filteredIcons.map((item) => (
            <CButton
              key={item.name}
              color={selectedIcon === item.name ? 'primary' : 'light'}
              variant={selectedIcon === item.name ? undefined : 'outline'}
              onClick={() => handleSelectIcon(item.name)}
              className="d-flex flex-column align-items-center justify-content-center"
              style={{
                height: '80px',
                fontSize: '10px',
                padding: '8px',
                cursor: 'pointer'
              }}
              title={item.name}
            >
              <CIcon
                icon={item.icon}
                size="xl"
                className="mb-1"
                style={{ color: selectedIcon === item.name ? '#fff' : '#333' }}
              />
              <span
                style={{
                  fontSize: '9px',
                  wordBreak: 'break-word',
                  textAlign: 'center',
                  lineHeight: '1.2'
                }}
              >
                {item.name}
              </span>
            </CButton>
          ))}
        </div>

        {filteredIcons.length === 0 && (
          <div className="text-center py-5 text-muted">
            <p>Nessuna icona trovata</p>
            <small>Prova con un termine diverso</small>
          </div>
        )}

        {/* Info */}
        <div className="mt-3 p-3 bg-light rounded">
          <small className="text-muted">
            <strong>Suggerimenti:</strong>
            <ul className="mb-0 mt-2">
              <li>
                <strong>cil*</strong> - CoreUI Line Icons (es: cilStar, cilHeart)
              </li>
              <li>
                <strong>cib*</strong> - CoreUI Brand Icons (es: cibFacebook, cibInstagram)
              </li>
              <li>
                <strong>cif*</strong> - CoreUI Flag Icons (es: cifIt, cifUs)
              </li>
            </ul>
          </small>
        </div>
      </CModalBody>
    </CModal>
  );
};

export default IconPicker;
