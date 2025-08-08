import React, { useState } from 'react'
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
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPencil, cilTrash, cilSave, cilX, cilPlus } from '@coreui/icons'

export interface ColumnDefinition<T> {
  key: keyof T
  label: string
  render?: (value: any, row: T) => React.ReactNode
}

// SmartTable.tsx

interface SmartTableProps<T> {
  items: T[]
  columns: ColumnDefinition<T>[]
  onAdd: (item: Partial<T>) => void
  onEdit: (item: T) => void
  onDelete: (item: T) => void
  getRowKey?: (item: T) => string | number
  expandedRowRender?: (item: T) => React.ReactNode
  showAddRow?: boolean // Mostra sempre la riga di aggiunta
}

function SmartTable<T extends { id: number }>({
  items,
  columns,
  onAdd,
  onEdit,
  onDelete,
  getRowKey = (item) => item.id,
  expandedRowRender,
  showAddRow = true,
}: SmartTableProps<T>) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editedRow, setEditedRow] = useState<Partial<T>>({})
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState<Partial<T>>({})

  return (
    <>
      <CTable striped hover responsive small>
        <CTableHead>
          <CTableRow>
            {columns.map((col) => (
              <CTableHeaderCell key={col.key.toString()}>
                {col.label}
              </CTableHeaderCell>
            ))}
            <CTableHeaderCell>Azioni</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {items.length === 0 && !showAddRow && (
            <CTableRow>
              <CTableDataCell colSpan={columns.length + 1} className="text-center text-muted py-3">
                Nessun elemento trovato
              </CTableDataCell>
            </CTableRow>
          )}
          {items.map((item) => {
            const rowKey = getRowKey(item)
            return (
              <React.Fragment key={rowKey}>
                <CTableRow>
                  {columns.map((col) => (
                    <CTableDataCell key={col.key.toString()}>
                      {editingId === item.id ? (
                        <CFormInput
                          value={(editedRow[col.key] as any) || ''}
                          onChange={(e) =>
                            setEditedRow({ ...editedRow, [col.key]: e.target.value })
                          }
                        />
                      ) : (
                        col.render ? col.render(item[col.key], item) : (item[col.key] as any)
                      )}
                    </CTableDataCell>
                  ))}
                  <CTableDataCell>
                    <CButtonGroup size="sm">
                      {editingId === item.id ? (
                        <>
                          <CButton 
                            color="success"
                            variant="outline"
                            onClick={() => { onEdit(editedRow as T); setEditingId(null); setEditedRow({}) }}
                          >
                            <CIcon icon={cilSave} />
                          </CButton>
                          <CButton 
                            color="secondary"
                            variant="outline"
                            onClick={() => { setEditingId(null); setEditedRow({}) }}
                          >
                            <CIcon icon={cilX} />
                          </CButton>
                        </>
                      ) : (
                        <>
                          <CButton 
                            color="warning"
                            variant="outline"
                            onClick={() => { setEditingId(item.id); setEditedRow(item) }}
                          >
                            <CIcon icon={cilPencil} />
                          </CButton>
                          <CButton 
                            color="danger"
                            variant="outline"
                            onClick={() => onDelete(item)}
                          >
                            <CIcon icon={cilTrash} />
                          </CButton>
                        </>
                      )}
                    </CButtonGroup>
                  </CTableDataCell>
                </CTableRow>
                {/* Riga espansa */}
                {expandedRowRender && expandedRowRender(item) && (
                  <CTableRow>
                    <CTableDataCell colSpan={columns.length + 1} className="p-0 border-0">
                      <div className="ps-4 py-3 bg-light border-start border-primary border-4">
                        {expandedRowRender(item)}
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                )}
              </React.Fragment>
            )
          })}
          {/* Riga aggiunta sempre visibile */}
          {showAddRow && (
            <CTableRow className="table-light">
              {columns.map((col) => (
                <CTableDataCell key={col.key.toString()}>
                  <CFormInput
                    size="sm"
                    value={(newRow[col.key] as any) || ''}
                    onChange={(e) =>
                      setNewRow({ ...newRow, [col.key]: e.target.value })
                    }
                    placeholder={`Nuovo ${col.label.toLowerCase()}...`}
                  />
                </CTableDataCell>
              ))}
              <CTableDataCell>
                <CButtonGroup size="sm">
                  <CButton 
                    color="success"
                    variant="outline"
                    onClick={() => { onAdd(newRow); setNewRow({}) }}
                    disabled={Object.keys(newRow).length === 0 || !Object.values(newRow).some(v => v)}
                  >
                    <CIcon icon={cilPlus} />
                  </CButton>
                  <CButton 
                    color="secondary"
                    variant="outline"
                    onClick={() => setNewRow({})}
                    disabled={Object.keys(newRow).length === 0}
                  >
                    <CIcon icon={cilX} />
                  </CButton>
                </CButtonGroup>
              </CTableDataCell>
            </CTableRow>
          )}
        </CTableBody>
      </CTable>
    </>
  )
}

export default SmartTable
