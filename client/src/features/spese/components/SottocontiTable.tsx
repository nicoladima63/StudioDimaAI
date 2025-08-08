import SmartTable from './SmartTable'
import type { ColumnDefinition } from './SmartTable'

export interface Sottoconto {
    id: number;
    contoid: number;
    brancaid: number;
    nome: string;
    conto_nome?: string;
    branca_nome?: string;
  }
  
interface SottocontiTableProps {
  sottoconti: Sottoconto[]
  brancaId: number
  brancaNome?: string
  onAdd?: (newItem: Partial<Sottoconto>) => void
  onEdit?: (updated: Sottoconto) => void
  onDelete?: (item: Sottoconto) => void
}

const SottocontiTable = ({ sottoconti, brancaId, brancaNome, onAdd, onEdit, onDelete }: SottocontiTableProps) => {
  const columns: ColumnDefinition<Sottoconto>[] = [
    { key: 'nome', label: 'Nome Sottoconto' },
  ]

  return (
    <div>
      <h6 className="text-info mb-2">📁 Sottoconti della branca {brancaNome || `#${brancaId}`} ({sottoconti.length})</h6>
      <SmartTable<Sottoconto>
        items={sottoconti}
        columns={columns}
        onAdd={(newSottoconto) => onAdd && onAdd({ ...newSottoconto, brancaid: brancaId })}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
}

export default SottocontiTable
