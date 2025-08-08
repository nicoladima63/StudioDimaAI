import React, { useState } from "react";
import { CButton } from "@coreui/react";
import CIcon from "@coreui/icons-react";
import { cilChevronRight, cilChevronBottom } from "@coreui/icons";
import SmartTable from "./SmartTable";
import type { ColumnDefinition } from "./SmartTable";
import BrancheTable from "./BrancheTable";
import type { Branca } from "./BrancheTable";
import type { Sottoconto } from "./SottocontiTable";

interface Conto {
  id: number;
  nome: string;
}

interface ContiTableProps {
  conti: Conto[];
  onAdd: (newItem: Partial<Conto>) => void;
  onEdit: (updated: Conto) => void;
  onDelete: (item: Conto) => void;

  branche?: Branca[];
  onAddBranca?: (newItem: Partial<Branca>) => void;
  onEditBranca?: (updated: Branca) => void;
  onDeleteBranca?: (item: Branca) => void;

  sottoconti?: Sottoconto[];
  onAddSottoconto?: (newItem: Partial<Sottoconto>) => void;
  onEditSottoconto?: (updated: Sottoconto) => void;
  onDeleteSottoconto?: (item: Sottoconto) => void;
}

const ContiTable = ({
  conti,
  onAdd,
  onEdit,
  onDelete,
  branche = [],
  onAddBranca,
  onEditBranca,
  onDeleteBranca,
  sottoconti = [],
  onAddSottoconto,
  onEditSottoconto,
  onDeleteSottoconto,
}: ContiTableProps) => {
  // Stato per riga espansa - solo una alla volta
  const [expandedConto, setExpandedConto] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedConto(expandedConto === id ? null : id);
  };

  // Definizione colonne di conti con bottone espandi
  const columns: ColumnDefinition<Conto>[] = [
    {
      key: "nome",
      label: "Nome",
      render: (_val, row) => (
        <div 
          className="d-flex align-items-center"
          style={{ cursor: 'pointer', width: '100%' }}
          onClick={() => toggleExpand(row.id)}
        >
          <CIcon 
            icon={expandedConto === row.id ? cilChevronBottom : cilChevronRight} 
            size="lg"
            className="me-2 text-primary"
            style={{ fontSize: '16px' }}
          />
          <strong>{row.nome}</strong>
        </div>
      ),
    },
  ];

  return (
    <div>
      <SmartTable<Conto>
        items={conti}
        columns={columns}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
        expandedRowRender={(conto) =>
          expandedConto === conto.id ? (
            <div style={{ paddingLeft: "2rem", marginTop: 8 }}>
              <BrancheTable
                branche={branche.filter((b) => b.contoid === conto.id)}
                contoId={conto.id}
                contoNome={conto.nome}
                onAdd={onAddBranca}
                onEdit={onEditBranca}
                onDelete={onDeleteBranca}
                sottoconti={sottoconti}
                onAddSottoconto={onAddSottoconto}
                onEditSottoconto={onEditSottoconto}
                onDeleteSottoconto={onDeleteSottoconto}
              />
            </div>
          ) : null
        }
      />
    </div>
  );
};

export default ContiTable;
