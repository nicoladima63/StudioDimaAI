/**
 * Sistema di auto-classificazione specifico per STUDIO/SERVIZI MISTI
 * Analizza le descrizioni delle spese per assegnare automaticamente i sottoconti
 */

export enum StudioSottoconto {
  GESTIONE_CONTABILE = 'GESTIONE_CONTABILE',
  GESTIONE_DIPENDENTI = 'GESTIONE_DIPENDENTI', 
  SPESE_GENERALI = 'SPESE_GENERALI'
}

export const STUDIO_SOTTOCONTI_LABELS: Record<StudioSottoconto, string> = {
  [StudioSottoconto.GESTIONE_CONTABILE]: 'Gestione Contabile',
  [StudioSottoconto.GESTIONE_DIPENDENTI]: 'Gestione Dipendenti',
  [StudioSottoconto.SPESE_GENERALI]: 'Spese Generali'
};

export interface StudioPattern {
  sottoconto: StudioSottoconto;
  confidence: number; // 0-1, dove 1 è certezza massima
  keywords: string[];
  description: string;
}

/**
 * Pattern per riconoscimento sottoconti dalle descrizioni delle spese
 */
export const STUDIO_PATTERNS: Record<string, StudioPattern> = {
  // === GESTIONE CONTABILE ===
  'contabilita_generale': {
    sottoconto: StudioSottoconto.GESTIONE_CONTABILE,
    confidence: 0.95,
    keywords: ['contabilità', 'contabile', 'tenuta contabilità'],
    description: 'Servizi di tenuta contabilità ordinaria'
  },
  'bilanci_dichiarazioni': {
    sottoconto: StudioSottoconto.GESTIONE_CONTABILE,
    confidence: 0.95,
    keywords: ['bilancio', 'dichiarazione', 'dichiarazioni fiscali', 'modello unico'],
    description: 'Bilanci e dichiarazioni fiscali'
  },
  'fiscale_iva': {
    sottoconto: StudioSottoconto.GESTIONE_CONTABILE,
    confidence: 0.9,
    keywords: ['iva', 'fiscale', 'imposte', 'f24', 'tributi', 'tasse'],
    description: 'Adempimenti fiscali e IVA'
  },
  'consulenza_fiscale': {
    sottoconto: StudioSottoconto.GESTIONE_CONTABILE,
    confidence: 0.85,
    keywords: ['consulenza fiscale', 'consulenza contabile', 'parere fiscale'],
    description: 'Consulenze in materia fiscale e contabile'
  },

  // === GESTIONE DIPENDENTI ===
  'buste_paga': {
    sottoconto: StudioSottoconto.GESTIONE_DIPENDENTI,
    confidence: 0.95,
    keywords: ['buste paga', 'stipendi', 'elaborazione paghe', 'cedolini'],
    description: 'Elaborazione buste paga e cedolini'
  },
  'contributi_previdenziali': {
    sottoconto: StudioSottoconto.GESTIONE_DIPENDENTI,
    confidence: 0.95,
    keywords: ['contributi', 'inps', 'inail', 'previdenziali', 'contributivi'],
    description: 'Adempimenti contributivi e previdenziali'
  },
  'consulenza_lavoro': {
    sottoconto: StudioSottoconto.GESTIONE_DIPENDENTI,
    confidence: 0.9,
    keywords: ['consulenza del lavoro', 'diritto del lavoro', 'rapporti di lavoro'],
    description: 'Consulenze in materia di lavoro e sindacale'
  },
  'tfr_liquidazioni': {
    sottoconto: StudioSottoconto.GESTIONE_DIPENDENTI,
    confidence: 0.9,
    keywords: ['tfr', 'liquidazione', 'fine rapporto', 'trattamento di fine rapporto'],
    description: 'TFR e liquidazioni'
  },
  'contratti_assunzioni': {
    sottoconto: StudioSottoconto.GESTIONE_DIPENDENTI,
    confidence: 0.85,
    keywords: ['contratto', 'assunzione', 'dipendenti', 'personale', 'ccnl'],
    description: 'Contratti di lavoro e assunzioni'
  },

  // === SPESE GENERALI ===
  'affitti_locazioni': {
    sottoconto: StudioSottoconto.SPESE_GENERALI,
    confidence: 0.95,
    keywords: ['affitto', 'sublocazione', 'locazione', 'canone', 'immobile'],
    description: 'Affitti e locazioni uffici'
  },
  'software_licenze': {
    sottoconto: StudioSottoconto.SPESE_GENERALI,
    confidence: 0.9,
    keywords: ['software', 'licenze', 'programma', 'gestionale', 'teamsystem'],
    description: 'Software e licenze gestionali'
  },
  'consulenze_varie': {
    sottoconto: StudioSottoconto.SPESE_GENERALI,
    confidence: 0.85,
    keywords: ['consulenza', 'esperto qualificato', 'sicurezza', 'privacy', 'gdpr'],
    description: 'Consulenze specialistiche varie'
  },
  'sicurezza_lavoro': {
    sottoconto: StudioSottoconto.SPESE_GENERALI,
    confidence: 0.9,
    keywords: ['sicurezza sul lavoro', 'rspp', 'rls', 'documento valutazione rischi', 'dvr'],
    description: 'Sicurezza sul lavoro e adempimenti'
  },
  'servizi_bancari': {
    sottoconto: StudioSottoconto.SPESE_GENERALI,
    confidence: 0.8,
    keywords: ['commissioni', 'spese bancarie', 'conto corrente', 'bonifico'],
    description: 'Servizi bancari e commissioni'
  },
  'utenze_generali': {
    sottoconto: StudioSottoconto.SPESE_GENERALI,
    confidence: 0.8,
    keywords: ['utenze', 'telefono', 'internet', 'energia elettrica', 'gas', 'acqua'],
    description: 'Utenze e servizi generali ufficio'
  }
};

export interface SpesaStudioAnalisi {
  descrizione: string;
  importo?: number;
  codice_fornitore?: string;
  nome_fornitore?: string;
}

export interface StudioClassificazioneResult {
  sottoconto: StudioSottoconto;
  sottoconto_nome: string;
  confidence: number;
  motivo: string;
  pattern_utilizzato?: string;
  suggerimenti?: string[];
}

/**
 * Analizza una spesa e determina il sottoconto appropriato per STUDIO/SERVIZI MISTI
 */
export function classificaSpesaStudio(spesa: SpesaStudioAnalisi): StudioClassificazioneResult {
  if (!spesa.descrizione) {
    return {
      sottoconto: StudioSottoconto.SPESE_GENERALI,
      sottoconto_nome: STUDIO_SOTTOCONTI_LABELS[StudioSottoconto.SPESE_GENERALI],
      confidence: 0.3,
      motivo: 'Nessuna descrizione disponibile - assegnato a spese generali',
      suggerimenti: ['Verifica la descrizione della spesa per una classificazione più precisa']
    };
  }

  const descrizione = spesa.descrizione.toLowerCase().trim();
  const risultati: Array<{
    sottoconto: StudioSottoconto;
    confidence: number;
    motivo: string;
    pattern: string;
  }> = [];

  // Analizza ogni pattern
  for (const [patternKey, pattern] of Object.entries(STUDIO_PATTERNS)) {
    for (const keyword of pattern.keywords) {
      if (descrizione.includes(keyword.toLowerCase())) {
        risultati.push({
          sottoconto: pattern.sottoconto,
          confidence: pattern.confidence,
          motivo: `Trovata keyword "${keyword}" nella descrizione`,
          pattern: patternKey
        });
        break; // Evita duplicati per lo stesso pattern
      }
    }
  }

  // Se non trova nessun pattern, fallback intelligente
  if (risultati.length === 0) {
    // Analisi euristica per parole chiave generiche
    if (descrizione.includes('paga') || descrizione.includes('stipend') || descrizione.includes('dipendent')) {
      return {
        sottoconto: StudioSottoconto.GESTIONE_DIPENDENTI,
        sottoconto_nome: STUDIO_SOTTOCONTI_LABELS[StudioSottoconto.GESTIONE_DIPENDENTI],
        confidence: 0.6,
        motivo: 'Analisi euristica: parole chiave relative ai dipendenti',
        suggerimenti: ['Considera di aggiungere pattern più specifici per questo tipo di spesa']
      };
    }

    if (descrizione.includes('contab') || descrizione.includes('fiscal') || descrizione.includes('dichiar')) {
      return {
        sottoconto: StudioSottoconto.GESTIONE_CONTABILE,
        sottoconto_nome: STUDIO_SOTTOCONTI_LABELS[StudioSottoconto.GESTIONE_CONTABILE],
        confidence: 0.6,
        motivo: 'Analisi euristica: parole chiave relative alla contabilità',
        suggerimenti: ['Considera di aggiungere pattern più specifici per questo tipo di spesa']
      };
    }

    // Default: spese generali
    return {
      sottoconto: StudioSottoconto.SPESE_GENERALI,
      sottoconto_nome: STUDIO_SOTTOCONTI_LABELS[StudioSottoconto.SPESE_GENERALI],
      confidence: 0.4,
      motivo: 'Nessun pattern riconosciuto - classificata come spesa generale',
      suggerimenti: [
        'Verifica manualmente la classificazione',
        'Considera di aggiungere pattern personalizzati se necessario'
      ]
    };
  }

  // Raggruppa per sottoconto e trova il migliore
  const sottocontiGrouped = risultati.reduce((acc, r) => {
    if (!acc[r.sottoconto]) {
      acc[r.sottoconto] = { 
        confidence: 0, 
        motivi: [], 
        patterns: []
      };
    }
    acc[r.sottoconto].confidence = Math.max(acc[r.sottoconto].confidence, r.confidence);
    acc[r.sottoconto].motivi.push(r.motivo);
    acc[r.sottoconto].patterns.push(r.pattern);
    return acc;
  }, {} as Record<StudioSottoconto, {
    confidence: number; 
    motivi: string[]; 
    patterns: string[]
  }>);

  // Trova il sottoconto con confidence maggiore
  const sottocontoFinale = Object.entries(sottocontiGrouped)
    .sort(([,a], [,b]) => b.confidence - a.confidence)[0];

  return {
    sottoconto: sottocontoFinale[0] as StudioSottoconto,
    sottoconto_nome: STUDIO_SOTTOCONTI_LABELS[sottocontoFinale[0] as StudioSottoconto],
    confidence: sottocontoFinale[1].confidence,
    motivo: sottocontoFinale[1].motivi.join(', '),
    pattern_utilizzato: sottocontoFinale[1].patterns[0],
    suggerimenti: sottocontoFinale[1].confidence < 0.8 ? [
      'Confidence non ottimale - verifica manualmente la classificazione'
    ] : undefined
  };
}

/**
 * Testa la classificazione su più spese e fornisce statistiche
 */
export function getStudioClassificationStats(spese: SpesaStudioAnalisi[]) {
  const classificazioni = spese.map(s => classificaSpesaStudio(s));
  
  const stats = classificazioni.reduce((acc, cls) => {
    if (!acc[cls.sottoconto]) {
      acc[cls.sottoconto] = { 
        count: 0, 
        totalConfidence: 0,
        avgConfidence: 0
      };
    }
    acc[cls.sottoconto].count++;
    acc[cls.sottoconto].totalConfidence += cls.confidence;
    acc[cls.sottoconto].avgConfidence = acc[cls.sottoconto].totalConfidence / acc[cls.sottoconto].count;
    return acc;
  }, {} as Record<StudioSottoconto, {
    count: number; 
    totalConfidence: number;
    avgConfidence: number;
  }>);

  const totaleSpese = spese.length;
  const confidenceMedia = classificazioni.reduce((sum, cls) => sum + cls.confidence, 0) / totaleSpese;
  const speseAltaConfidence = classificazioni.filter(cls => cls.confidence >= 0.8).length;

  return {
    totaleSpese,
    confidenceMedia: Math.round(confidenceMedia * 100) / 100,
    speseAltaConfidence,
    percentualeAltaConfidence: Math.round((speseAltaConfidence / totaleSpese) * 100),
    distribuzioneSottoconti: Object.entries(stats).map(([sottoconto, stat]) => ({
      sottoconto: sottoconto as StudioSottoconto,
      label: STUDIO_SOTTOCONTI_LABELS[sottoconto as StudioSottoconto],
      count: stat.count,
      percentuale: Math.round((stat.count / totaleSpese) * 100),
      confidenceMedia: Math.round(stat.avgConfidence * 100) / 100
    })).sort((a, b) => b.count - a.count)
  };
}

/**
 * Esporta le classificazioni con i dettagli per review
 */
export function esportaClassificazioniStudio(spese: SpesaStudioAnalisi[]): Array<SpesaStudioAnalisi & StudioClassificazioneResult> {
  return spese.map(spesa => ({
    ...spesa,
    ...classificaSpesaStudio(spesa)
  }));
}

/**
 * Suggerimenti per migliorare la classificazione
 */
export function getSuggerimentiMiglioramentoStudio(spese: SpesaStudioAnalisi[]): string[] {
  const classificazioni = spese.map(s => classificaSpesaStudio(s));
  const suggerimenti: Set<string> = new Set();

  // Analizza spese con bassa confidence
  const speseBassaConfidence = classificazioni.filter(c => c.confidence < 0.7);
  if (speseBassaConfidence.length > 0) {
    suggerimenti.add(`${speseBassaConfidence.length} spese hanno bassa confidence (<70%) - considera di aggiungere pattern più specifici`);
  }

  // Analizza descrizioni non riconosciute
  const speseNonRiconosciute = spese.filter((_, i) => classificazioni[i].confidence < 0.5);
  if (speseNonRiconosciute.length > 0) {
    const parolePiuComuni = speseNonRiconosciute
      .map(s => s.descrizione.toLowerCase())
      .join(' ')
      .split(/\s+/)
      .filter(p => p.length > 3)
      .reduce((acc, parola) => {
        acc[parola] = (acc[parola] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const topParole = Object.entries(parolePiuComuni)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([parola]) => parola);

    if (topParole.length > 0) {
      suggerimenti.add(`Parole frequenti nelle spese non riconosciute: ${topParole.join(', ')}`);
    }
  }

  return Array.from(suggerimenti);
}