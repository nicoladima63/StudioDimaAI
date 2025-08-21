import React, { useState } from "react";
import {
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CButton,
  CFormInput,
  CButtonGroup,
} from "@coreui/react";
import CIcon from "@coreui/icons-react";
import { cilPencil, cilTrash, cilSave, cilX, cilPlus } from "@coreui/icons";
import { 
  useBranche, 
  useSottoconti, 
  useContiStore,
  type Conto,
  type Branca,
  type Sottoconto
} from '@/store/conti.store';

interface ContiTableProps {
    conti: Conto[];
    onAdd: (newItem: Partial<Conto>) => void;
    onEdit: (updated: Conto) => void;
    onDelete: (item: Conto) => void;
    onAddBranca: (newItem: Partial<Branca>) => void;
    onEditBranca: (updated: Branca) => void;
    onDeleteBranca: (item: Branca) => void;
    onAddSottoconto?: (newItem: Partial<Sottoconto>) => void;
    onEditSottoconto?: (updated: Sottoconto) => void;
    onDeleteSottoconto?: (item: Sottoconto) => void;
}



const ContiTable: React.FC<ContiTableProps> = ({ 
  conti,
  onAdd,
  onEdit,
  onDelete,
  onAddBranca,
  onEditBranca,
  onDeleteBranca,
  onAddSottoconto,
  onEditSottoconto,
  onDeleteSottoconto,
 }) => {
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editedRow, setEditedRow] = useState<Partial<Conto>>({});
    const [newRow, setNewRow] = useState<Partial<Conto>>({});

    // Editing state per branche
    const [editingBrancaId, setEditingBrancaId] = useState<number | null>(null);
    const [editedBranca, setEditedBranca] = useState<Partial<Branca>>({});
    const [newBranca, setNewBranca] = useState<Partial<Branca>>({});

    // Editing state per sottoconti
    const [expandedBrancaId, setExpandedBrancaId] = useState<number | null>(null);
    const [editingSottocontoId, setEditingSottocontoId] = useState<number | null>(null);
    const [editedSottoconto, setEditedSottoconto] = useState<Partial<Sottoconto>>({});
    const [newSottoconto, setNewSottoconto] = useState<Partial<Sottoconto>>({});

    const { loadBranche, brancheByConto, loadSottoconti, sottocontiByBranca } = useContiStore();

    const toggleExpandBranca = async (brancaId: number, contoId: number) => {
      if (expandedBrancaId === brancaId) {
        setExpandedBrancaId(null);
      } else {
        setExpandedBrancaId(brancaId);
        await loadSottoconti(brancaId);
      }
    };

    const toggleExpand = async (id: number) => {
      if (expandedId === id) {
        setExpandedId(null);
      } else {
        setExpandedId(id);
        await loadBranche(id);
      }
    };

  return (
    <CTable striped hover responsive small>
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>Nome</CTableHeaderCell>
          <CTableHeaderCell>Azioni</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {conti.length === 0 && (
          <CTableRow>
            <CTableDataCell colSpan={2} className="text-center text-muted py-3">
              Nessun conto trovato
            </CTableDataCell>
          </CTableRow>
        )}
        {conti.map((item) => (
          <React.Fragment key={item.id}>
            <CTableRow
              onClick={() => toggleExpand(item.id)}
              style={{ cursor: 'pointer' }}
            >
              <CTableDataCell
                onDoubleClick={e => {
                  e.stopPropagation();
                  setEditingId(item.id);
                  setEditedRow(item);
                }}
>
                {editingId === item.id ? (
                  <CFormInput
                    value={editedRow.nome || ""}
                    onChange={(e) => setEditedRow({ ...editedRow, nome: e.target.value })}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') { onEdit(editedRow as Conto); setEditingId(null); setEditedRow({}); } }}
                  />
                ) : (
                  <strong>{item.nome}</strong>
                )}
              </CTableDataCell>
              <CTableDataCell>
                <CButtonGroup size="sm">
                  {editingId === item.id ? (
                    <>
                      <CButton color="success" variant="outline" onClick={() => { onEdit(editedRow as Conto); setEditingId(null); setEditedRow({}); }}>
                        <CIcon icon={cilSave} />
                      </CButton>
                      <CButton color="secondary" variant="outline" onClick={() => { setEditingId(null); setEditedRow({}); }}>
                        <CIcon icon={cilX} />
                      </CButton>
                    </>
                  ) : (
                    <>
                      <CButton color="warning" variant="outline" onClick={e => { e.stopPropagation(); setEditingId(item.id); setEditedRow(item); }}>
                        <CIcon icon={cilPencil} />
                      </CButton>
                      <CButton color="danger" variant="outline" onClick={e => { e.stopPropagation(); onDelete(item); }}>
                        <CIcon icon={cilTrash} />
                      </CButton>
                    </>
                  )}
                </CButtonGroup>
              </CTableDataCell>
            </CTableRow>
            {expandedId === item.id && (
              <CTableRow>
                <CTableDataCell colSpan={2} className="bg-light">
                  <div style={{ padding: '1rem' }}>
                    <strong className="mb-3 d-block">Branche del Conto: {item.nome}</strong>
                    
                    {/* Tabella branche */}
                    <CTable size="sm" className="mb-3">
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>Nome Branca</CTableHeaderCell>
                          <CTableHeaderCell width="120px">Azioni</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {(brancheByConto[item.id] || []).map(branca => (
                          <React.Fragment key={branca.id}>
                            <CTableRow 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandBranca(branca.id, item.id);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <CTableDataCell
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingBrancaId(branca.id);
                                  setEditedBranca(branca);
                                }}
                              >
                                {editingBrancaId === branca.id ? (
                                  <CFormInput
                                    value={editedBranca.nome || ""}
                                    onChange={(e) => setEditedBranca({ ...editedBranca, nome: e.target.value })}
                                    autoFocus
                                    size="sm"
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        onEditBranca({ ...branca, ...editedBranca } as Branca);
                                        setEditingBrancaId(null);
                                        setEditedBranca({});
                                      }
                                    }}
                                  />
                                ) : (
                                  `📁 ${branca.nome}`
                                )}
                              </CTableDataCell>
                              <CTableDataCell>
                                <CButtonGroup size="sm">
                                  {editingBrancaId === branca.id ? (
                                    <>
                                      <CButton 
                                        color="success" 
                                        variant="outline" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onEditBranca({ ...branca, ...editedBranca } as Branca);
                                          setEditingBrancaId(null);
                                          setEditedBranca({});
                                        }}
                                      >
                                        <CIcon icon={cilSave} />
                                      </CButton>
                                      <CButton 
                                        color="secondary" 
                                        variant="outline" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingBrancaId(null);
                                          setEditedBranca({});
                                        }}
                                      >
                                        <CIcon icon={cilX} />
                                      </CButton>
                                    </>
                                  ) : (
                                    <>
                                      <CButton 
                                        color="warning" 
                                        variant="outline" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingBrancaId(branca.id);
                                          setEditedBranca(branca);
                                        }}
                                      >
                                        <CIcon icon={cilPencil} />
                                      </CButton>
                                      <CButton 
                                        color="danger" 
                                        variant="outline" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDeleteBranca(branca);
                                        }}
                                      >
                                        <CIcon icon={cilTrash} />
                                      </CButton>
                                    </>
                                  )}
                                </CButtonGroup>
                              </CTableDataCell>
                            </CTableRow>

                            {/* Sottoconti della branca espansa */}
                            {expandedBrancaId === branca.id && (
                              <CTableRow>
                                <CTableDataCell colSpan={2} className="bg-secondary bg-opacity-10">
                                  <div style={{ padding: '0.5rem 1rem', marginLeft: '20px' }}>
                                    <strong className="mb-2 d-block">Sottoconti della Branca: {branca.nome}</strong>
                                    
                                    {/* Sottoconti table */}
                                    <CTable size="sm" className="mb-2">
                                      <CTableHead>
                                        <CTableRow>
                                          <CTableHeaderCell>Nome Sottoconto</CTableHeaderCell>
                                          <CTableHeaderCell width="120px">Azioni</CTableHeaderCell>
                                        </CTableRow>
                                      </CTableHead>
                                      <CTableBody>
                                        {(sottocontiByBranca[branca.id] || [])
                                          .map(sottoconto => (
                                            <CTableRow key={sottoconto.id}>
                                              <CTableDataCell
                                                onDoubleClick={() => {
                                                  setEditingSottocontoId(sottoconto.id);
                                                  setEditedSottoconto(sottoconto);
                                                }}
                                              >
                                                {editingSottocontoId === sottoconto.id ? (
                                                  <CFormInput
                                                    value={editedSottoconto.nome || ""}
                                                    onChange={(e) => setEditedSottoconto({ ...editedSottoconto, nome: e.target.value })}
                                                    autoFocus
                                                    size="sm"
                                                    onKeyDown={e => {
                                                      if (e.key === 'Enter') {
                                                        onEditSottoconto && onEditSottoconto({ ...sottoconto, ...editedSottoconto } as Sottoconto);
                                                        setEditingSottocontoId(null);
                                                        setEditedSottoconto({});
                                                      }
                                                    }}
                                                  />
                                                ) : (
                                                  sottoconto.nome
                                                )}
                                              </CTableDataCell>
                                              <CTableDataCell>
                                                <CButtonGroup size="sm">
                                                  {editingSottocontoId === sottoconto.id ? (
                                                    <>
                                                      <CButton 
                                                        color="success" 
                                                        variant="outline" 
                                                        onClick={() => {
                                                          onEditSottoconto && onEditSottoconto({ ...sottoconto, ...editedSottoconto } as Sottoconto);
                                                          setEditingSottocontoId(null);
                                                          setEditedSottoconto({});
                                                        }}
                                                      >
                                                        <CIcon icon={cilSave} />
                                                      </CButton>
                                                      <CButton 
                                                        color="secondary" 
                                                        variant="outline" 
                                                        onClick={() => {
                                                          setEditingSottocontoId(null);
                                                          setEditedSottoconto({});
                                                        }}
                                                      >
                                                        <CIcon icon={cilX} />
                                                      </CButton>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <CButton 
                                                        color="warning" 
                                                        variant="outline" 
                                                        onClick={() => {
                                                          setEditingSottocontoId(sottoconto.id);
                                                          setEditedSottoconto(sottoconto);
                                                        }}
                                                      >
                                                        <CIcon icon={cilPencil} />
                                                      </CButton>
                                                      <CButton 
                                                        color="danger" 
                                                        variant="outline" 
                                                        onClick={() => onDeleteSottoconto && onDeleteSottoconto(sottoconto)}
                                                      >
                                                        <CIcon icon={cilTrash} />
                                                      </CButton>
                                                    </>
                                                  )}
                                                </CButtonGroup>
                                              </CTableDataCell>
                                            </CTableRow>
                                          ))}
                                        
                                        {/* Riga per aggiungere nuovo sottoconto */}
                                        <CTableRow className="table-light">
                                          <CTableDataCell>
                                            <CFormInput
                                              size="sm"
                                              value={newSottoconto.nome || ''}
                                              onChange={(e) => setNewSottoconto({ 
                                                ...newSottoconto, 
                                                nome: e.target.value,
                                                contoId: item.id,
                                                brancaId: branca.id
                                              })}
                                              placeholder="Nuovo sottoconto..."
                                              onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                  onAddSottoconto && onAddSottoconto({ 
                                                    ...newSottoconto, 
                                                    contoId: item.id,
                                                    brancaId: branca.id
                                                  });
                                                  setNewSottoconto({});
                                                }
                                              }}
                                            />
                                          </CTableDataCell>
                                          <CTableDataCell>
                                            <CButtonGroup size="sm">
                                              <CButton
                                                color="success"
                                                variant="outline"
                                                onClick={() => {
                                                  onAddSottoconto && onAddSottoconto({ 
                                                    ...newSottoconto, 
                                                    contoId: item.id,
                                                    brancaId: branca.id
                                                  });
                                                  setNewSottoconto({});
                                                }}
                                                disabled={!newSottoconto.nome}
                                              >
                                                <CIcon icon={cilPlus} />
                                              </CButton>
                                              <CButton
                                                color="secondary"
                                                variant="outline"
                                                onClick={() => setNewSottoconto({})}
                                                disabled={!newSottoconto.nome}
                                              >
                                                <CIcon icon={cilX} />
                                              </CButton>
                                            </CButtonGroup>
                                          </CTableDataCell>
                                        </CTableRow>
                                      </CTableBody>
                                    </CTable>

                                    {(sottocontiByBranca[branca.id] || []).length === 0 && (
                                      <div className="text-muted text-center py-2 mb-2" style={{fontSize: '0.85em'}}>
                                        Nessun sottoconto presente. Aggiungi il primo sottoconto sopra.
                                      </div>
                                    )}
                                  </div>
                                </CTableDataCell>
                              </CTableRow>
                            )}
                          </React.Fragment>
                        ))}
                        
                        {/* Riga per aggiungere nuova branca */}
                        <CTableRow className="table-light">
                          <CTableDataCell>
                            <CFormInput
                              size="sm"
                              value={newBranca.nome || ''}
                              onChange={(e) => setNewBranca({ 
                                ...newBranca, 
                                nome: e.target.value,
                                contoId: item.id
                              })}
                              placeholder="Nuova branca..."
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  onAddBranca({ ...newBranca, contoId: item.id });
                                  setNewBranca({});
                                }
                              }}
                            />
                          </CTableDataCell>
                          <CTableDataCell>
                            <CButtonGroup size="sm">
                              <CButton
                                color="success"
                                variant="outline"
                                onClick={() => {
                                  onAddBranca({ ...newBranca, contoId: item.id });
                                  setNewBranca({});
                                }}
                                disabled={!newBranca.nome}
                              >
                                <CIcon icon={cilPlus} />
                              </CButton>
                              <CButton
                                color="secondary"
                                variant="outline"
                                onClick={() => setNewBranca({})}
                                disabled={!newBranca.nome}
                              >
                                <CIcon icon={cilX} />
                              </CButton>
                            </CButtonGroup>
                          </CTableDataCell>
                        </CTableRow>
                      </CTableBody>
                    </CTable>

                    {(brancheByConto[item.id] || []).length === 0 && (
                      <div className="text-muted text-center py-2 mb-3">
                        Nessuna branca presente. Aggiungi la prima branca sopra.
                      </div>
                    )}
                  </div>
                </CTableDataCell>
              </CTableRow>
            )}
          </React.Fragment>
        ))}
        {/* Riga aggiunta sempre visibile */}
        <CTableRow className="table-light">
          <CTableDataCell>
            <CFormInput
              size="sm"
              value={newRow.nome || ''}
              onChange={(e) => setNewRow({ ...newRow, nome: e.target.value })}
              placeholder="Nuovo conto..."
              onKeyDown={e => { if (e.key === 'Enter') { onAdd(newRow); setNewRow({}); } }}
            />
          </CTableDataCell>
          <CTableDataCell>
            <CButtonGroup size="sm">
              <CButton
                color="success"
                variant="outline"
                onClick={() => { onAdd(newRow); setNewRow({}); }}
                disabled={!newRow.nome}
              >
                <CIcon icon={cilPlus} />
              </CButton>
              <CButton
                color="secondary"
                variant="outline"
                onClick={() => setNewRow({})}
                disabled={!newRow.nome}
              >
                <CIcon icon={cilX} />
              </CButton>
            </CButtonGroup>
          </CTableDataCell>
        </CTableRow>
      </CTableBody>
    </CTable>
  );
};


export default ContiTable;
