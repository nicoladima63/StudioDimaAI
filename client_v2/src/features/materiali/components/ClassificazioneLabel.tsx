import React from 'react'
import { Badge } from '@/components/ui/badge'
import type { ClassificazioneNomi, StatoProdotto } from '../types/catalogo'

const STATO_LABEL: Record<StatoProdotto, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  classificato: { label: 'Classificato', variant: 'success' },
  parziale: { label: 'Parziale', variant: 'warning' },
  da_classificare: { label: 'Da classificare', variant: 'destructive' },
}

export const StatoBadge: React.FC<{ stato: StatoProdotto }> = ({ stato }) => {
  const { label, variant } = STATO_LABEL[stato]
  return <Badge variant={variant}>{label}</Badge>
}

export const ClassificazioneLabel: React.FC<{ nomi: ClassificazioneNomi }> = ({ nomi }) => {
  const parti = [nomi.contonome, nomi.brancanome, nomi.sottocontonome].filter(Boolean)
  if (parti.length === 0) {
    return <span className="text-muted-foreground">Non classificato</span>
  }
  return (
    <span className="text-sm">
      {parti.map((parte, index) => (
        <React.Fragment key={`${parte}-${index}`}>
          {index > 0 && <span className="px-1 text-muted-foreground">&rsaquo;</span>}
          <span className={index === 0 ? 'text-muted-foreground' : 'font-medium'}>{parte}</span>
        </React.Fragment>
      ))}
    </span>
  )
}
