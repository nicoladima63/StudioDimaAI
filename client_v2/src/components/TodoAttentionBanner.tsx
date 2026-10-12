import React, { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import { todoService } from '@/services/api/todos'
import type { Todo } from '@/services/api/todos'

const REFRESH_MS = 5 * 60 * 1000
// Il banner torna a ogni fascia di richiamo (ogni 2 ore) finche il todo non e completato
const SLOT_HOURS = 2
const STORAGE_KEY = 'todo-banner-dismissed-slot'

const currentSlot = (): string => {
  const now = new Date()
  return `${now.toDateString()}-${Math.floor(now.getHours() / SLOT_HOURS)}`
}

const readDismissedSlot = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const writeDismissedSlot = (slot: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, slot)
  } catch {
    // Senza storage il banner ricompare al prossimo aggiornamento: accettabile
  }
}

const isOverdue = (todo: Todo): boolean => {
  const due = todo.due_date ? todo.due_date.slice(0, 10) : ''
  return due !== '' && due < new Date().toLocaleDateString('sv-SE')
}

/**
 * Richiamo in pagina per i todo scaduti o in scadenza oggi.
 * Chiuderlo non lo toglie di mezzo: porta al todo, e se il todo non viene
 * completato il banner ricompare alla fascia successiva.
 */
const TodoAttentionBanner: React.FC = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [todos, setTodos] = useState<Todo[]>([])
  const [slot, setSlot] = useState<string>(currentSlot())
  const [dismissedSlot, setDismissedSlot] = useState<string | null>(readDismissedSlot())

  const refresh = useCallback(async () => {
    if (!user?.id) return
    try {
      const response = await todoService.apiGetAttention(user.id)
      setTodos(response.success && response.data ? response.data.todos : [])
      setSlot(currentSlot())
    } catch {
      // Un errore di rete non deve disturbare: si riprova al prossimo giro
    }
  }, [user?.id])

  useEffect(() => {
    refresh()
    const interval = window.setInterval(refresh, REFRESH_MS)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  // Nella pagina dei todo il banner e superfluo
  if (!user || todos.length === 0 || pathname.startsWith('/todos')) return null
  if (dismissedSlot === slot) return null

  const first = todos[0]!
  const overdueCount = todos.filter(isOverdue).length
  const label = isOverdue(first) ? 'scaduto' : 'in scadenza oggi'

  const openTodo = () => {
    writeDismissedSlot(slot)
    setDismissedSlot(slot)
    navigate(`/todos?open=${first.id}`)
  }

  return (
    <div
      role="alert"
      className="mb-3 flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-foreground">
          {todos.length === 1
            ? `Todo ${label}: ${first.subject}`
            : `Hai ${todos.length} todo da completare (${overdueCount} scaduti). Il più urgente: ${first.subject}`}
        </p>
        <p className="text-muted-foreground">
          Se non lo completi questo avviso continuerà a ripresentarsi.
        </p>
      </div>
      <Button size="sm" onClick={openTodo}>
        Vai al todo
      </Button>
      <button
        type="button"
        onClick={openTodo}
        aria-label="Chiudi e apri il todo"
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default TodoAttentionBanner
