import React, { useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useContiStore } from '@/store/conti.store'
import type { ClassificazioneIds } from '../types/catalogo'

const ALL = '__all__'

interface ClassificazioneSelectProps {
  value: ClassificazioneIds
  onChange: (value: ClassificazioneIds) => void
  /** Aggiunge la voce "Tutti" a ogni livello: da usare nei filtri. */
  clearable?: boolean
  disabled?: boolean
  className?: string
}

const ClassificazioneSelect: React.FC<ClassificazioneSelectProps> = ({ value, onChange, clearable = false, disabled, className }) => {
  const conti = useContiStore((s) => s.conti)
  const branche = useContiStore((s) => (value.contoid ? s.brancheByConto[value.contoid] : undefined))
  const sottoconti = useContiStore((s) => (value.brancaid ? s.sottocontiByBranca[value.brancaid] : undefined))
  const loadConti = useContiStore((s) => s.loadConti)
  const loadBranche = useContiStore((s) => s.loadBranche)
  const loadSottoconti = useContiStore((s) => s.loadSottoconti)

  useEffect(() => {
    void loadConti()
  }, [loadConti])

  useEffect(() => {
    if (value.contoid) void loadBranche(value.contoid)
  }, [value.contoid, loadBranche])

  useEffect(() => {
    if (value.brancaid) void loadSottoconti(value.brancaid)
  }, [value.brancaid, loadSottoconti])

  const toValue = (id: number | null) => (id ? String(id) : clearable ? ALL : '')
  const toId = (raw: string) => (raw && raw !== ALL ? Number(raw) : null)

  return (
    <div className={className ?? 'grid gap-2 sm:grid-cols-3'}>
      <Select
        value={toValue(value.contoid)}
        onValueChange={(raw) => onChange({ contoid: toId(raw), brancaid: null, sottocontoid: null })}
        disabled={disabled ?? false}
      >
        <SelectTrigger aria-label="Conto">
          <SelectValue placeholder="Conto" />
        </SelectTrigger>
        <SelectContent>
          {clearable && <SelectItem value={ALL}>Tutti i conti</SelectItem>}
          {conti.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={toValue(value.brancaid)}
        onValueChange={(raw) => onChange({ ...value, brancaid: toId(raw), sottocontoid: null })}
        disabled={disabled || !value.contoid}
      >
        <SelectTrigger aria-label="Branca">
          <SelectValue placeholder="Branca" />
        </SelectTrigger>
        <SelectContent>
          {clearable && <SelectItem value={ALL}>Tutte le branche</SelectItem>}
          {(branche ?? []).map((b) => (
            <SelectItem key={b.id} value={String(b.id)}>{b.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={toValue(value.sottocontoid)}
        onValueChange={(raw) => onChange({ ...value, sottocontoid: toId(raw) })}
        disabled={disabled || !value.brancaid}
      >
        <SelectTrigger aria-label="Sottoconto">
          <SelectValue placeholder="Sottoconto" />
        </SelectTrigger>
        <SelectContent>
          {clearable && <SelectItem value={ALL}>Tutti i sottoconti</SelectItem>}
          {(sottoconti ?? []).map((s) => (
            <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default ClassificazioneSelect
