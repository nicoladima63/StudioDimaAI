# Matrice di Eisenhower collegata ai todo - Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TempoPage.tsx` diventa una vista dei todo aperti dell'utente: quadrante = priorita', drag per cambiare priorita', click verso il todo, pulsante "Eseguito".

**Architecture:** Solo frontend. Una mappa pura priorita' <-> quadrante in `features/tempo/tempo.ts`; la pagina carica i todo con `todoService.getPending`, li raggruppa per quadrante e li modifica con `todoService.update` e `todoService.complete`. Nessuna modifica a backend o database.

**Tech Stack:** React 18, TypeScript, CoreUI (`@coreui/react`), `react-hot-toast`, `vitest` + `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-10-22-tempo-todo-matrix-design.md`

## Global Constraints

- Mappa priorita' <-> quadrante: `urgent` = Q1, `high` = Q2, `medium` = Q3, `low` = Q4. Priorita' mancante o sconosciuta = Q3.
- Nessuna modifica a backend o database. Endpoint usati: `GET /todos/pending?user_id=`, `PATCH /todos/<id>` con `priority`, `POST /todos/<id>/complete`.
- Drag nativo HTML5 gia' presente nella pagina. Niente touch, niente `@dnd-kit`.
- Componenti CoreUI per l'interfaccia; skeleton (`@/components/ui/skeleton`) al posto dello spinner.
- Toast con `react-hot-toast`: `toast.success` per l'esito positivo, `toast.error` per l'errore.
- Usare `import type` per i tipi TypeScript; nessun `console.log` nel codice finale.
- Utente dall'auth store: `const { user } = useAuthStore();` come in `TodosPage`.
- Il click sulla card naviga a `/todos?open=<id>`.
- Stile del file: punto e virgola, apici singoli, JSX con apici singoli, indentazione a 2 spazi (come l'attuale `TempoPage.tsx`).
- Tutti i comandi si lanciano dalla cartella `client_v2`. Non avviare il server.

## Mappa dei file

| File | Azione | Responsabilita' |
|---|---|---|
| `client_v2/src/features/tempo/tempo.ts` | Crea | Titoli dei quadranti e mappa pura priorita' <-> quadrante |
| `client_v2/src/features/tempo/tempo.test.ts` | Crea | Test della mappa |
| `client_v2/src/features/tempo/pages/TempoPage.tsx` | Riscrive | Carica, mostra, cerca, sposta, completa |
| `client_v2/src/features/tempo/pages/TempoPage.test.tsx` | Crea | Test della pagina con `todoService` simulato |

Il router non cambia: la rotta (`EisenhowerMatrixPage`) esiste gia' e importa il default export di `TempoPage`.

---

### Task 1: Mappa priorita' <-> quadrante

**Files:**
- Create: `client_v2/src/features/tempo/tempo.ts`
- Test: `client_v2/src/features/tempo/tempo.test.ts`

**Interfaces:**
- Produces (usato dal Task 2 e dal Task 3):
  - `type Priority = Todo['priority']`
  - `type Quadrant = 1 | 2 | 3 | 4`
  - `interface QuadrantInfo { title: string; subtitle: string; priorityLabel: string; color: string; icon: string }`
  - `QUADRANT_ORDER: Quadrant[]` (= `[1, 2, 3, 4]`)
  - `QUADRANTS: Record<Quadrant, QuadrantInfo>`
  - `quadrantOfPriority(priority?: string | null): Quadrant`
  - `priorityOfQuadrant(quadrant: Quadrant): Priority`

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `client_v2/src/features/tempo/tempo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { priorityOfQuadrant, quadrantOfPriority } from './tempo';
import type { Quadrant } from './tempo';

describe('mappa priorita-quadrante', () => {
  it.each<[string, Quadrant]>([
    ['urgent', 1],
    ['high', 2],
    ['medium', 3],
    ['low', 4],
  ])('%s sta nel quadrante %i e ci torna', (priority, quadrant) => {
    expect(quadrantOfPriority(priority)).toBe(quadrant);
    expect(priorityOfQuadrant(quadrant)).toBe(priority);
  });

  it.each([undefined, null, '', 'critica', 'constructor'])(
    'la priorita %s va nel quadrante 3',
    priority => {
      expect(quadrantOfPriority(priority)).toBe(3);
    }
  );
});
```

- [ ] **Step 2: Lancia il test e verifica che fallisca**

Run: `npx vitest run src/features/tempo/tempo.test.ts`
Expected: FAIL con un errore di import, perche' `./tempo` non esiste ("Failed to resolve import './tempo'").

- [ ] **Step 3: Scrivi l'implementazione minima**

Crea `client_v2/src/features/tempo/tempo.ts`:

```ts
import type { Todo } from '@/services/api/todos';

export type Priority = Todo['priority'];
export type Quadrant = 1 | 2 | 3 | 4;

export interface QuadrantInfo {
  title: string;
  subtitle: string;
  priorityLabel: string;
  color: string;
  icon: string;
}

export const QUADRANT_ORDER: Quadrant[] = [1, 2, 3, 4];

export const QUADRANTS: Record<Quadrant, QuadrantInfo> = {
  1: { title: 'Urgente e Importante', subtitle: 'Fare subito', priorityLabel: 'urgente', color: 'danger', icon: '🔥' },
  2: { title: 'Non Urgente ma Importante', subtitle: 'Pianificare', priorityLabel: 'alta', color: 'success', icon: '📅' },
  3: { title: 'Urgente ma Non Importante', subtitle: 'Delegare', priorityLabel: 'media', color: 'warning', icon: '👥' },
  4: { title: 'Non Urgente e Non Importante', subtitle: 'Eliminare', priorityLabel: 'bassa', color: 'secondary', icon: '🗑️' },
};

// Una sola mappa per leggere e per scrivere: la matrice e' una vista della priorita' del todo
const PRIORITY_TO_QUADRANT = new Map<string, Quadrant>([
  ['urgent', 1],
  ['high', 2],
  ['medium', 3],
  ['low', 4],
]);

const QUADRANT_TO_PRIORITY: Record<Quadrant, Priority> = { 1: 'urgent', 2: 'high', 3: 'medium', 4: 'low' };

// Priorita' mancante o sconosciuta: Q3, come la priorita' predefinita 'medium'
export const quadrantOfPriority = (priority?: string | null): Quadrant =>
  PRIORITY_TO_QUADRANT.get(priority ?? '') ?? 3;

export const priorityOfQuadrant = (quadrant: Quadrant): Priority => QUADRANT_TO_PRIORITY[quadrant];
```

- [ ] **Step 4: Lancia il test e verifica che passi**

Run: `npx vitest run src/features/tempo/tempo.test.ts`
Expected: PASS, `Tests  9 passed (9)`.

- [ ] **Step 5: Commit**

```bash
git add client_v2/src/features/tempo/tempo.ts client_v2/src/features/tempo/tempo.test.ts
git commit -m "feat(tempo): mappa priorita' <-> quadrante della matrice" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: La pagina mostra i todo (sola lettura)

**Files:**
- Modify (riscrittura completa): `client_v2/src/features/tempo/pages/TempoPage.tsx`
- Test: `client_v2/src/features/tempo/pages/TempoPage.test.tsx`

**Interfaces:**
- Consumes (dal Task 1): `QUADRANT_ORDER`, `QUADRANTS`, `quadrantOfPriority`, tipo `Quadrant` da `../tempo`.
- Consumes (esistenti): `todoService.getPending(userId: number): Promise<TodoListResponse>` con `TodoListResponse = { success: boolean; data: Todo[]; message?: string }`; `useAuthStore()` che ritorna `{ user }` con `user?.id: number`.
- Produces (usato dal Task 3): la pagina con questi punti di aggancio nel codice, che il Task 3 modifica: la riga `import { cilCalendar, cilSearch, cilX } from '@coreui/icons';`, la riga `import { QUADRANT_ORDER, QUADRANTS, quadrantOfPriority } from '../tempo';`, la riga `const [searchTerm, setSearchTerm] = useState('');`, la riga `const byQuadrant = useMemo(() => {`, il blocco `<CCard role='region' ...>`, la riga `const overdue = isOverdue(todo);`, il blocco `<CListGroupItem ...>` e la chiusura `</CListGroupItem>`.

- [ ] **Step 1: Scrivi i test che falliscono**

Crea `client_v2/src/features/tempo/pages/TempoPage.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import toast from 'react-hot-toast';
import TempoPage from './TempoPage';
import { todoService } from '@/services/api/todos';
import type { Todo } from '@/services/api/todos';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/store/auth.store', () => ({ useAuthStore: () => ({ user: { id: 7 } }) }));
vi.mock('@/services/api/todos', () => ({
  todoService: { getPending: vi.fn(), update: vi.fn(), complete: vi.fn() },
}));

const makeTodo = (id: number, subject: string, priority: Todo['priority'], extra: Partial<Todo> = {}): Todo => ({
  id,
  sender_id: 1,
  recipient_id: 7,
  subject,
  priority,
  status: 'pending',
  type: 'general',
  urgency_level: 'normal',
  created_at: '2026-10-01T10:00:00',
  updated_at: '2026-10-01T10:00:00',
  ...extra,
});

const TODOS = [
  makeTodo(1, 'Chiamare il laboratorio', 'urgent'),
  makeTodo(2, 'Ordinare i guanti', 'high', { message: 'Sono finiti i guanti taglia M' }),
  makeTodo(3, 'Aggiornare il listino', 'medium'),
  makeTodo(4, 'Sistemare lo scaffale', 'low'),
];

const quadrant = (title: string) => within(screen.getByRole('region', { name: title }));

const loadPage = async () => {
  render(<TempoPage />);
  await screen.findByRole('listitem', { name: 'Chiamare il laboratorio' });
};

describe('TempoPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(todoService.getPending).mockResolvedValue({ success: true, data: TODOS });
  });

  it('carica i todo dell utente e li mette nel quadrante della loro priorita', async () => {
    await loadPage();
    expect(todoService.getPending).toHaveBeenCalledWith(7);
    expect(quadrant('Urgente e Importante').getByRole('listitem', { name: 'Chiamare il laboratorio' })).toBeInTheDocument();
    expect(quadrant('Non Urgente ma Importante').getByRole('listitem', { name: 'Ordinare i guanti' })).toBeInTheDocument();
    expect(quadrant('Urgente ma Non Importante').getByRole('listitem', { name: 'Aggiornare il listino' })).toBeInTheDocument();
    expect(quadrant('Non Urgente e Non Importante').getByRole('listitem', { name: 'Sistemare lo scaffale' })).toBeInTheDocument();
    expect(quadrant('Urgente e Importante').queryByRole('listitem', { name: 'Ordinare i guanti' })).not.toBeInTheDocument();
  });

  it('riporta il nome della priorita nell intestazione di ogni quadrante', async () => {
    await loadPage();
    expect(screen.getByText('Fare subito · priorità urgente')).toBeInTheDocument();
    expect(screen.getByText('Pianificare · priorità alta')).toBeInTheDocument();
    expect(screen.getByText('Delegare · priorità media')).toBeInTheDocument();
    expect(screen.getByText('Eliminare · priorità bassa')).toBeInTheDocument();
  });

  it('la ricerca filtra su oggetto e messaggio', async () => {
    await loadPage();
    fireEvent.change(screen.getByRole('textbox', { name: 'Cerca todo' }), { target: { value: 'guanti taglia' } });
    expect(screen.getByRole('listitem', { name: 'Ordinare i guanti' })).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Chiamare il laboratorio' })).not.toBeInTheDocument();
  });

  it('mostra quanti todo sono aperti e quanti scaduti', async () => {
    vi.mocked(todoService.getPending).mockResolvedValue({
      success: true,
      data: [...TODOS, makeTodo(5, 'Pratica scaduta', 'low', { due_date: '2020-01-01T00:00:00' })],
    });
    await loadPage();
    expect(screen.getByText('Aperti: 5')).toBeInTheDocument();
    expect(screen.getByText('Scaduti: 1')).toBeInTheDocument();
    expect(within(screen.getByRole('listitem', { name: 'Pratica scaduta' })).getByText(/SCADUTO/)).toBeInTheDocument();
  });

  it('il click sulla card apre il todo nella pagina Todo', async () => {
    await loadPage();
    fireEvent.click(screen.getByRole('listitem', { name: 'Chiamare il laboratorio' }));
    expect(navigate).toHaveBeenCalledWith('/todos?open=1');
  });

  it('se il caricamento fallisce mostra Riprova e ricarica', async () => {
    vi.mocked(todoService.getPending).mockRejectedValueOnce(new Error('rete'));
    render(<TempoPage />);
    const retry = await screen.findByRole('button', { name: 'Riprova' });
    expect(toast.error).toHaveBeenCalledWith('Errore nel caricamento dei todo');
    fireEvent.click(retry);
    expect(await screen.findByRole('listitem', { name: 'Chiamare il laboratorio' })).toBeInTheDocument();
    expect(todoService.getPending).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Lancia i test e verifica che falliscano**

Run: `npx vitest run src/features/tempo/pages/TempoPage.test.tsx`
Expected: FAIL su tutti e 6 i test. La pagina attuale non chiama `getPending` e non ha regioni con nome, quindi si vedono errori come `Unable to find role="listitem" and name "Chiamare il laboratorio"`.

- [ ] **Step 3: Riscrivi la pagina (sola lettura)**

Sostituisci l'intero contenuto di `client_v2/src/features/tempo/pages/TempoPage.tsx` con:

```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CListGroup,
  CListGroupItem,
  CRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCalendar, cilSearch, cilX } from '@coreui/icons';
import PageLayout from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth.store';
import { todoService } from '@/services/api/todos';
import type { Todo } from '@/services/api/todos';
import { QUADRANT_ORDER, QUADRANTS, quadrantOfPriority } from '../tempo';
import type { Quadrant } from '../tempo';

const MESSAGE_EXCERPT = 120;

const excerpt = (message: string): string =>
  message.length > MESSAGE_EXCERPT ? `${message.slice(0, MESSAGE_EXCERPT - 3)}...` : message;

const isOverdue = (todo: Todo): boolean => !!todo.due_date && new Date(todo.due_date) < new Date();

const dueLabel = (dueDate: string): string => {
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return ' - SCADUTO';
  if (days === 0) return ' - OGGI';
  if (days === 1) return ' - Domani';
  if (days <= 7) return ` - ${days} giorni`;
  return '';
};

const TempoPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId = user?.id;
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(async (): Promise<void> => {
    if (userId === undefined) return;
    setLoading(true);
    setLoadError(false);
    try {
      const response = await todoService.getPending(userId);
      if (!response.success) throw new Error(response.message);
      setTodos(response.data);
    } catch {
      setLoadError(true);
      toast.error('Errore nel caricamento dei todo');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const byQuadrant = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const groups: Record<Quadrant, Todo[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const todo of todos) {
      const text = `${todo.subject} ${todo.message ?? ''}`.toLowerCase();
      if (!term || text.includes(term)) groups[quadrantOfPriority(todo.priority)].push(todo);
    }
    return groups;
  }, [todos, searchTerm]);

  const overdueCount = todos.filter(isOverdue).length;

  return (
    <PageLayout>
      <PageLayout.Header title='Matrice di Eisenhower' />
      <PageLayout.ContentHeader>
        <CRow>
          <CCol md={6}>
            <CInputGroup>
              <CInputGroupText>
                <CIcon icon={cilSearch} />
              </CInputGroupText>
              <CFormInput
                aria-label='Cerca todo'
                placeholder='Cerca todo...'
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
              />
              {searchTerm && (
                <CButton color='secondary' variant='outline' aria-label='Svuota la ricerca' onClick={() => setSearchTerm('')}>
                  <CIcon icon={cilX} />
                </CButton>
              )}
            </CInputGroup>
          </CCol>
          <CCol md={6}>
            <CAlert color='info' className='d-flex flex-wrap gap-3 align-items-center mb-0'>
              <span>{`Aperti: ${todos.length}`}</span>
              {overdueCount > 0 && <span className='text-danger'>{`Scaduti: ${overdueCount}`}</span>}
            </CAlert>
          </CCol>
        </CRow>
      </PageLayout.ContentHeader>

      <PageLayout.ContentBody>
        {loading ? (
          <CRow>
            {QUADRANT_ORDER.map(quadrant => (
              <CCol md={6} key={quadrant} className='mb-4'>
                <Skeleton className='h-6 w-1/2 mb-3' />
                <Skeleton className='h-16 w-full mb-2' />
                <Skeleton className='h-16 w-full' />
              </CCol>
            ))}
          </CRow>
        ) : loadError ? (
          <CAlert color='danger' className='d-flex justify-content-between align-items-center'>
            <span>Impossibile caricare i todo.</span>
            <CButton color='danger' variant='outline' size='sm' onClick={() => void load()}>
              Riprova
            </CButton>
          </CAlert>
        ) : (
          <CRow>
            {QUADRANT_ORDER.map(quadrant => {
              const info = QUADRANTS[quadrant];
              return (
                <CCol md={6} key={quadrant} className='mb-4'>
                  <CCard
                    role='region'
                    aria-label={info.title}
                    className={`border-${info.color} h-100`}
                    style={{ minHeight: '300px' }}
                  >
                    <CCardHeader className={`bg-${info.color} text-white`}>
                      <div className='d-flex justify-content-between align-items-center'>
                        <div>
                          <strong>
                            {info.icon} {info.title}
                          </strong>
                          <div className='small'>{`${info.subtitle} · priorità ${info.priorityLabel}`}</div>
                        </div>
                        <CBadge color='light' className='text-dark'>
                          {byQuadrant[quadrant].length}
                        </CBadge>
                      </div>
                    </CCardHeader>
                    <CCardBody>
                      <CListGroup flush>
                        {byQuadrant[quadrant].length === 0 ? (
                          <div className='text-center text-muted py-4'>
                            {searchTerm ? 'Nessun todo corrispondente' : 'Nessun todo'}
                          </div>
                        ) : (
                          byQuadrant[quadrant].map(todo => {
                            const overdue = isOverdue(todo);
                            return (
                              <CListGroupItem
                                key={todo.id}
                                aria-label={todo.subject}
                                onClick={() => navigate(`/todos?open=${todo.id}`)}
                                className='d-flex justify-content-between align-items-start'
                                style={{ cursor: 'pointer' }}
                              >
                                <div className='flex-grow-1'>
                                  <strong>{todo.subject}</strong>
                                  {todo.message && <div className='small text-muted mt-1'>{excerpt(todo.message)}</div>}
                                  {todo.due_date && (
                                    <div className={`small mt-2 ${overdue ? 'text-danger fw-bold' : 'text-muted'}`}>
                                      <CIcon icon={cilCalendar} size='sm' className='me-1' />
                                      {new Date(todo.due_date).toLocaleDateString('it-IT')}
                                      {dueLabel(todo.due_date)}
                                    </div>
                                  )}
                                </div>
                              </CListGroupItem>
                            );
                          })
                        )}
                      </CListGroup>
                    </CCardBody>
                  </CCard>
                </CCol>
              );
            })}
          </CRow>
        )}
      </PageLayout.ContentBody>
    </PageLayout>
  );
};

export default TempoPage;
```

- [ ] **Step 4: Lancia i test e verifica che passino**

Run: `npx vitest run src/features/tempo`
Expected: PASS, `Test Files  2 passed (2)` e `Tests  15 passed (15)` (9 della mappa + 6 della pagina).

- [ ] **Step 5: Controlla i tipi sui file toccati**

Run: `npm run type-check 2>&1 | grep "features/tempo"`
Expected: nessuna riga in output (zero errori nei file della feature).

- [ ] **Step 6: Commit**

```bash
git add client_v2/src/features/tempo/pages/TempoPage.tsx client_v2/src/features/tempo/pages/TempoPage.test.tsx
git commit -m "feat(tempo): la matrice mostra i todo aperti per priorita'" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Completare un todo e spostarlo con il drag

**Files:**
- Modify: `client_v2/src/features/tempo/pages/TempoPage.tsx`
- Test: `client_v2/src/features/tempo/pages/TempoPage.test.tsx`

**Interfaces:**
- Consumes (dal Task 1): `priorityOfQuadrant(quadrant: Quadrant): Priority`.
- Consumes (esistenti): `todoService.update(todoId: number, data: Partial<Todo>): Promise<TodoResponse>` e `todoService.complete(todoId: number, userId: number): Promise<TodoResponse>`, con `TodoResponse = { success: boolean; data?: Todo; message?: string }`.

- [ ] **Step 1: Aggiungi i test che falliscono**

In `TempoPage.test.tsx` importa anche `waitFor`: cambia la riga

```tsx
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
```

in

```tsx
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
```

Poi aggiungi questo helper subito dopo la funzione `loadPage`:

```tsx
const dragTo = (name: string, title: string) => {
  const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
  fireEvent.dragStart(screen.getByRole('listitem', { name }), { dataTransfer });
  fireEvent.drop(screen.getByRole('region', { name: title }), { dataTransfer });
};
```

E aggiungi questi cinque test dentro `describe('TempoPage', ...)`, dopo l'ultimo test esistente:

```tsx
  it('Eseguito completa il todo e toglie la card senza aprirlo', async () => {
    vi.mocked(todoService.complete).mockResolvedValue({ success: true });
    await loadPage();
    const card = screen.getByRole('listitem', { name: 'Chiamare il laboratorio' });
    fireEvent.click(within(card).getByRole('button', { name: 'Eseguito' }));
    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: 'Chiamare il laboratorio' })).not.toBeInTheDocument()
    );
    expect(todoService.complete).toHaveBeenCalledWith(1, 7);
    expect(toast.success).toHaveBeenCalledWith('Todo completato');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('se il completamento fallisce la card resta e compare l errore', async () => {
    vi.mocked(todoService.complete).mockRejectedValue(new Error('rete'));
    await loadPage();
    const card = screen.getByRole('listitem', { name: 'Chiamare il laboratorio' });
    fireEvent.click(within(card).getByRole('button', { name: 'Eseguito' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Errore nel completamento'));
    expect(screen.getByRole('listitem', { name: 'Chiamare il laboratorio' })).toBeInTheDocument();
  });

  it('il drop su un altro quadrante cambia la priorita e sposta la card', async () => {
    vi.mocked(todoService.update).mockResolvedValue({ success: true });
    await loadPage();
    dragTo('Chiamare il laboratorio', 'Urgente ma Non Importante');
    expect(todoService.update).toHaveBeenCalledWith(1, { priority: 'medium' });
    await waitFor(() =>
      expect(
        quadrant('Urgente ma Non Importante').getByRole('listitem', { name: 'Chiamare il laboratorio' })
      ).toBeInTheDocument()
    );
    expect(
      quadrant('Urgente e Importante').queryByRole('listitem', { name: 'Chiamare il laboratorio' })
    ).not.toBeInTheDocument();
  });

  it('se lo spostamento fallisce la card torna nel quadrante di partenza', async () => {
    vi.mocked(todoService.update).mockRejectedValue(new Error('rete'));
    await loadPage();
    dragTo('Chiamare il laboratorio', 'Urgente ma Non Importante');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Errore nello spostamento del todo'));
    await waitFor(() =>
      expect(
        quadrant('Urgente e Importante').getByRole('listitem', { name: 'Chiamare il laboratorio' })
      ).toBeInTheDocument()
    );
  });

  it('il drop sullo stesso quadrante non fa nulla', async () => {
    await loadPage();
    dragTo('Chiamare il laboratorio', 'Urgente e Importante');
    expect(todoService.update).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Lancia i test e verifica che falliscano**

Run: `npx vitest run src/features/tempo/pages/TempoPage.test.tsx`
Expected: i 6 test del Task 2 passano, i 5 nuovi falliscono (non c'e' un pulsante `Eseguito` e il drop non chiama `update`).

- [ ] **Step 3: Aggiungi le azioni alla pagina**

Applica queste sette modifiche a `TempoPage.tsx`, in ordine.

**3a. Icona del pulsante.** Sostituisci

```tsx
import { cilCalendar, cilSearch, cilX } from '@coreui/icons';
```

con

```tsx
import { cilCalendar, cilCheckCircle, cilSearch, cilX } from '@coreui/icons';
```

**3b. Funzione di conversione.** Sostituisci

```tsx
import { QUADRANT_ORDER, QUADRANTS, quadrantOfPriority } from '../tempo';
```

con

```tsx
import { QUADRANT_ORDER, QUADRANTS, priorityOfQuadrant, quadrantOfPriority } from '../tempo';
```

**3c. Stato del drag e dei salvataggi.** Sostituisci

```tsx
  const [searchTerm, setSearchTerm] = useState('');
```

con

```tsx
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [savingIds, setSavingIds] = useState<number[]>([]);
```

**3d. Gestori delle azioni.** Sostituisci la riga

```tsx
  const byQuadrant = useMemo(() => {
```

con questo blocco seguito dalla stessa riga:

```tsx
  const markSaving = (id: number, saving: boolean): void =>
    setSavingIds(ids => (saving ? [...ids, id] : ids.filter(savingId => savingId !== id)));

  const handleComplete = async (todo: Todo): Promise<void> => {
    if (userId === undefined || savingIds.includes(todo.id)) return;
    markSaving(todo.id, true);
    try {
      const response = await todoService.complete(todo.id, userId);
      if (!response.success) throw new Error(response.message);
      setTodos(current => current.filter(item => item.id !== todo.id));
      toast.success('Todo completato');
    } catch {
      toast.error('Errore nel completamento');
    } finally {
      markSaving(todo.id, false);
    }
  };

  const handleDragStart = (event: React.DragEvent, todo: Todo): void => {
    setDraggedId(todo.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(todo.id)); // Firefox non avvia il drag senza dati
  };

  const handleDragOver = (event: React.DragEvent): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (event: React.DragEvent, target: Quadrant): Promise<void> => {
    event.preventDefault();
    const todo = todos.find(item => item.id === draggedId);
    setDraggedId(null);
    if (!todo || savingIds.includes(todo.id) || quadrantOfPriority(todo.priority) === target) return;

    const previous = todo.priority;
    const priority = priorityOfQuadrant(target);
    setTodos(current => current.map(item => (item.id === todo.id ? { ...item, priority } : item)));
    markSaving(todo.id, true);
    try {
      const response = await todoService.update(todo.id, { priority });
      if (!response.success) throw new Error(response.message);
    } catch {
      setTodos(current => current.map(item => (item.id === todo.id ? { ...item, priority: previous } : item)));
      toast.error('Errore nello spostamento del todo');
    } finally {
      markSaving(todo.id, false);
    }
  };

  const byQuadrant = useMemo(() => {
```

**3e. Il quadrante accetta il drop.** Sostituisci

```tsx
                    className={`border-${info.color} h-100`}
                    style={{ minHeight: '300px' }}
```

con

```tsx
                    className={`border-${info.color} h-100`}
                    onDragOver={handleDragOver}
                    onDrop={event => void handleDrop(event, quadrant)}
                    style={{ minHeight: '300px' }}
```

**3f. La card si trascina.** Sostituisci

```tsx
                            const overdue = isOverdue(todo);
```

con

```tsx
                            const overdue = isOverdue(todo);
                            const saving = savingIds.includes(todo.id);
```

e sostituisci

```tsx
                                aria-label={todo.subject}
                                onClick={() => navigate(`/todos?open=${todo.id}`)}
                                className='d-flex justify-content-between align-items-start'
                                style={{ cursor: 'pointer' }}
```

con

```tsx
                                aria-label={todo.subject}
                                draggable={!saving}
                                onDragStart={event => handleDragStart(event, todo)}
                                onDragEnd={() => setDraggedId(null)}
                                onClick={() => navigate(`/todos?open=${todo.id}`)}
                                className='d-flex justify-content-between align-items-start'
                                style={{ cursor: saving ? 'progress' : 'grab', opacity: saving ? 0.6 : 1 }}
```

**3g. Il pulsante "Eseguito".** Sostituisci

```tsx
                              </CListGroupItem>
```

con

```tsx
                                <CButton
                                  color='success'
                                  variant='ghost'
                                  size='sm'
                                  className='ms-2'
                                  disabled={saving}
                                  onClick={event => {
                                    event.stopPropagation();
                                    void handleComplete(todo);
                                  }}
                                >
                                  <CIcon icon={cilCheckCircle} className='me-1' />
                                  Eseguito
                                </CButton>
                              </CListGroupItem>
```

- [ ] **Step 4: Lancia tutti i test della feature**

Run: `npx vitest run src/features/tempo`
Expected: PASS, `Test Files  2 passed (2)` e `Tests  20 passed (20)` (9 + 11).

- [ ] **Step 5: Controlla i tipi sui file toccati**

Run: `npm run type-check 2>&1 | grep "features/tempo"`
Expected: nessuna riga in output.

- [ ] **Step 6: Commit**

```bash
git add client_v2/src/features/tempo/pages/TempoPage.tsx client_v2/src/features/tempo/pages/TempoPage.test.tsx
git commit -m "feat(tempo): Eseguito e drag tra i quadranti cambiano stato e priorita' del todo" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Verifica finale

**Files:** nessuna modifica prevista.

- [ ] **Step 1: Tutti i test del frontend**

Run: `npx vitest run`
Expected: nessun test fallito. Se falliscono test fuori da `features/tempo`, controlla con `git stash` se falliscono anche senza le tue modifiche prima di intervenire.

- [ ] **Step 2: Tipi, senza nuovi errori**

Run: `npm run type-check 2>&1 | grep -c "error TS"`
Expected: un numero minore o uguale a 195 (era 195 prima; la vecchia `TempoPage` ne contava almeno 2, quindi ci si aspetta 193 o meno).
Run: `npm run type-check 2>&1 | grep "features/tempo"`
Expected: nessuna riga.

- [ ] **Step 3: Lint sui file della feature**

Run: `npx eslint src/features/tempo --ext ts,tsx --max-warnings 0`
Expected: nessun errore. Eventuali problemi in altri file del progetto sono preesistenti e vanno ignorati.

- [ ] **Step 4: Nessun residuo del vecchio salvataggio locale**

Run: `grep -rn "eisenhower_matrix_data\|console.log" src/features/tempo`
Expected: nessuna riga.

- [ ] **Step 5: Prova manuale nel browser (a cura dell'utente, il server e' gia' acceso)**

Apri la pagina Tempo e controlla:
- ogni todo aperto e' nel quadrante della sua priorita' (le notifiche di fase `high` nel Q2, i `medium` nel Q3);
- l'intestazione di ogni quadrante riporta "priorita' urgente / alta / media / bassa";
- trascina una card in un altro quadrante: si sposta subito; poi apri la pagina Todo e verifica che la priorita' sia cambiata;
- il click sulla card apre il modal del todo nella pagina Todo;
- "Eseguito" toglie la card e mostra il toast verde; nella pagina Todo il todo risulta completato;
- la ricerca filtra per oggetto e per testo del messaggio.
