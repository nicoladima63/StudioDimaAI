import * as React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

interface PaginationBarProps {
  page: number
  pages: number
  total: number
  perPage: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
  disabled?: boolean
}

const PaginationBar: React.FC<PaginationBarProps> = ({ page, pages, total, perPage, onPageChange, onPerPageChange, disabled }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
    <span>{total} risultati</span>
    <div className="flex flex-wrap items-center gap-2">
      <span>Per pagina</span>
      <Select value={String(perPage)} onValueChange={(value) => onPerPageChange(Number(value))} disabled={disabled ?? false}>
        <SelectTrigger className="h-8 w-[76px]" aria-label="Elementi per pagina">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <SelectItem key={size} value={String(size)}>{size}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="icon-sm" onClick={() => onPageChange(1)} disabled={disabled || page <= 1} aria-label="Prima pagina">
        <ChevronsLeft />
      </Button>
      <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page - 1)} disabled={disabled || page <= 1} aria-label="Pagina precedente">
        <ChevronLeft />
      </Button>
      <span className="min-w-[96px] text-center text-foreground">Pagina {page} di {pages}</span>
      <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page + 1)} disabled={disabled || page >= pages} aria-label="Pagina successiva">
        <ChevronRight />
      </Button>
      <Button variant="outline" size="icon-sm" onClick={() => onPageChange(pages)} disabled={disabled || page >= pages} aria-label="Ultima pagina">
        <ChevronsRight />
      </Button>
    </div>
  </div>
)

export default PaginationBar
