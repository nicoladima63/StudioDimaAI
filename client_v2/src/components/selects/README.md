# Componenti Select Evoluti - StudioDimaAI v2

Questa directory contiene i componenti Select evoluti con ricerca automatica e controllo del valore esterno.

## Componenti Disponibili

### ContiSelect
Componente per la selezione dei conti con ricerca automatica.

```tsx
import ContiSelect from './components/selects/ContiSelect';

function MyComponent() {
  const [contoId, setContoId] = useState<number | null>(null);

  return (
    <ContiSelect
      value={contoId}
      onChange={setContoId}
      searchable={true}
      placeholder="Cerca conto..."
      autoSelectIfSingle={true}
    />
  );
}
```

### BrancheSelect
Componente per la selezione delle branche (dipende dal conto selezionato).

```tsx
import BrancheSelect from './components/selects/BrancheSelect';

function MyComponent() {
  const [contoId, setContoId] = useState<number | null>(null);
  const [brancaId, setBrancaId] = useState<number | null>(null);

  return (
    <BrancheSelect
      contoId={contoId}
      value={brancaId}
      onChange={setBrancaId}
      searchable={true}
      autoSelectIfSingle={true}
    />
  );
}
```

### SottocontiSelect
Componente per la selezione dei sottoconti (dipende dalla branca selezionata).

```tsx
import SottocontiSelect from './components/selects/SottocontiSelect';

function MyComponent() {
  const [brancaId, setBrancaId] = useState<number | null>(null);
  const [sottocontoId, setSottocontoId] = useState<number | null>(null);

  return (
    <SottocontiSelect
      brancaId={brancaId}
      value={sottocontoId}
      onChange={setSottocontoId}
      searchable={true}
      autoSelectIfSingle={true}
    />
  );
}
```

### FornitoriSelect
Componente per la selezione dei fornitori con ricerca avanzata.

```tsx
import FornitoriSelect from './components/selects/FornitoriSelect';
import { Fornitore } from '../store/fornitori.store';

function MyComponent() {
  const [fornitore, setFornitore] = useState<Fornitore | null>(null);

  return (
    <FornitoriSelect
      value={fornitore?.id || null}
      onChange={setFornitore}
      searchable={true}
      placeholder="Cerca fornitore per nome, codice o P.IVA..."
    />
  );
}
```

### MaterialiSelect
Componente per la selezione dei materiali con filtri avanzati.

```tsx
import MaterialiSelect from './components/selects/MaterialiSelect';
import { MaterialeIntelligente } from '../store/materiali.store';

function MyComponent() {
  const [fornitoreId, setFornitoreId] = useState<string | null>(null);
  const [materiale, setMateriale] = useState<MaterialeIntelligente | null>(null);

  return (
    <MaterialiSelect
      fornitoreId={fornitoreId}
      value={materiale?.codice_articolo || null}
      onChange={setMateriale}
      searchable={true}
      showClassified={false}
      filterByClassificazione={{
        contoid: 1,
        brancaid: 2
      }}
    />
  );
}
```

## Props Comuni

Tutti i componenti Select supportano queste props base:

- `value`: Valore corrente selezionato
- `onChange`: Callback chiamata quando cambia la selezione
- `placeholder`: Testo placeholder (default: "-- Seleziona... --")
- `disabled`: Disabilita il componente
- `searchable`: Abilita la ricerca (default: true)
- `className`: Classi CSS aggiuntive

## Esempio Completo - Selezione Gerarchica

```tsx
import React, { useState } from 'react';
import ContiSelect from './components/selects/ContiSelect';
import BrancheSelect from './components/selects/BrancheSelect';
import SottocontiSelect from './components/selects/SottocontiSelect';

function ClassificazioneForm() {
  const [contoId, setContoId] = useState<number | null>(null);
  const [brancaId, setBrancaId] = useState<number | null>(null);
  const [sottocontoId, setSottocontoId] = useState<number | null>(null);

  return (
    <div className="row">
      <div className="col-md-4">
        <label>Conto</label>
        <ContiSelect
          value={contoId}
          onChange={setContoId}
          autoSelectIfSingle={true}
        />
      </div>
      
      <div className="col-md-4">
        <label>Branca</label>
        <BrancheSelect
          contoId={contoId}
          value={brancaId}
          onChange={setBrancaId}
          autoSelectIfSingle={true}
        />
      </div>
      
      <div className="col-md-4">
        <label>Sottoconto</label>
        <SottocontiSelect
          brancaId={brancaId}
          value={sottocontoId}
          onChange={setSottocontoId}
          autoSelectIfSingle={true}
        />
      </div>
    </div>
  );
}
```

## Store Utilizzati

I componenti utilizzano i seguenti store Zustand:

- `conti.store.ts`: Per conti, branche e sottoconti
- `fornitori.store.ts`: Per i fornitori
- `materiali.store.ts`: Per i materiali

Tutti gli store implementano:
- Cache intelligente (5 minuti)
- Retry automatico (3 tentativi)
- Persistenza locale
- Gestione errori

## Funzionalità Avanzate

### Ricerca in Tempo Reale
Tutti i componenti con `searchable={true}` filtrano i risultati mentre l'utente digita.

### Auto-selezione
Con `autoSelectIfSingle={true}`, se c'è un solo elemento disponibile viene selezionato automaticamente.

### Cascading
I componenti BrancheSelect e SottocontiSelect si resettano automaticamente quando cambia il loro parent.

### Lazy Loading
I dati vengono caricati solo quando necessario e cachati per migliorare le performance.

### Gestione Errori
Ogni componente mostra messaggi di errore appropriati e gestisce gli stati di loading.