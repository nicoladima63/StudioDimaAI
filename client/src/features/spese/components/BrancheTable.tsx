import { useState } from 'react'
import { CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilChevronRight, cilChevronBottom } from '@coreui/icons'
import SmartTable from './SmartTable'
import type { ColumnDefinition } from './SmartTable'
import SottocontiTable from './SottocontiTable'
import type {Sottoconto} from './SottocontiTable'

export interface Branca {
    id: number;
    contoid: number;
    nome: string;
    conto_nome?: string;
  }

  
interface BrancheTableProps {
  branche: Branca[]
  contoId: number
  contoNome?: string
  onAdd?: (newItem: Partial<Branca>) => void
  onEdit?: (updated: Branca) => void
  onDelete?: (item: Branca) => void

  // Props per sottoconti
  sottoconti?: Sottoconto[]
  onAddSottoconto?: (newItem: Partial<Sottoconto>) => void
  onEditSottoconto?: (updated: Sottoconto) => void
  onDeleteSottoconto?: (item: Sottoconto) => void
}

const BrancheTable = ({
  branche,
  contoId,
  contoNome,
  onAdd,
  onEdit,
  onDelete,
  sottoconti = [],
  onAddSottoconto,
  onEditSottoconto,
  onDeleteSottoconto,
}: BrancheTableProps) => {
  const [expandedBranca, setExpandedBranca] = useState<number | null>(null)

  const toggleExpand = (id: number) => {
    setExpandedBranca(expandedBranca === id ? null : id)
  }

  const columns: ColumnDefinition<Branca>[] = [
    {
      key: 'nome',
      label: 'Nome Branca',
      render: (_val: any, row: Branca) => (
        <div 
          className="d-flex align-items-center"
          style={{ cursor: 'pointer', width: '100%' }}
          onClick={() => toggleExpand(row.id)}
        >
          <CIcon 
            icon={expandedBranca === row.id ? cilChevronBottom : cilChevronRight} 
            size="lg"
            className="me-2 text-success"
            style={{ fontSize: '14px' }}
          />
          <strong>{row.nome}</strong>
        </div>
      ),
    },
  ]

  return (
    <div>
      <h6 className="text-success mb-2">🌿 Branche del conto {contoNome || `#${contoId}`}</h6>
      <SmartTable<Branca>
        items={branche}
        columns={columns}
        onAdd={(newBranca) => onAdd && onAdd({ ...newBranca, contoid: contoId })}
        onEdit={onEdit}
        onDelete={onDelete}
        expandedRowRender={(branca) => {
          if (expandedBranca === branca.id) {
            const filteredSottoconti = sottoconti.filter((s) => s.brancaid === branca.id);
            return (
              <div style={{ paddingLeft: "2rem", marginTop: 8 }}>
                <SottocontiTable
                  sottoconti={filteredSottoconti}
                  brancaId={branca.id}
                  brancaNome={branca.nome}
                  onAdd={onAddSottoconto}
                  onEdit={onEditSottoconto}
                  onDelete={onDeleteSottoconto}
                />
              </div>
            );
          }
          return null;
        }}
      />
    </div>
  )
}

export default BrancheTable
