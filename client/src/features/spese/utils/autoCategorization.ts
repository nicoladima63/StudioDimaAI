/**
 * Sistema di auto-categorizzazione delle spese fornitori
 * Basato sull'analisi dei pattern nel database esistente
 */

export interface FornitorePattern {
  categoria: CategoriaSpesa;
  confidence: number; // 0-1, dove 1 è certezza massima
  keywords: string[];
  pattern?: RegExp;
}

export enum CategoriaSpesa {
  ENERGIA_ELETTRICA = 'ENERGIA_ELETTRICA',
  GAS_METANO = 'GAS_METANO', 
  ACQUA_UTENZE = 'ACQUA_UTENZE',
  TELECOMUNICAZIONI = 'TELECOMUNICAZIONI',
  INTERNET_HOSTING = 'INTERNET_HOSTING',
  MATERIALI_DENTALI = 'MATERIALI_DENTALI',
  APPARECCHIATURE_MEDICHE = 'APPARECCHIATURE_MEDICHE',
  FARMACEUTICI = 'FARMACEUTICI',
  LEASING_FINANZIARIO = 'LEASING_FINANZIARIO',
  CONSULENZE_PROFESSIONALI = 'CONSULENZE_PROFESSIONALI',
  SERVIZI_BANCARI = 'SERVIZI_BANCARI',
  MANUTENZIONI_RIPARAZIONI = 'MANUTENZIONI_RIPARAZIONI',
  ASSICURAZIONI = 'ASSICURAZIONI',
  FORMAZIONE_AGGIORNAMENTO = 'FORMAZIONE_AGGIORNAMENTO',
  TASSE_IMPOSTE = 'TASSE_IMPOSTE',
  AFFITTI_LOCAZIONI = 'AFFITTI_LOCAZIONI',
  CARBURANTI = 'CARBURANTI',
  ALTRO = 'ALTRO'
}

export const CATEGORIE_LABELS: Record<CategoriaSpesa, string> = {
  [CategoriaSpesa.ENERGIA_ELETTRICA]: 'Energia Elettrica',
  [CategoriaSpesa.GAS_METANO]: 'Gas Metano',
  [CategoriaSpesa.ACQUA_UTENZE]: 'Acqua e Utenze',
  [CategoriaSpesa.TELECOMUNICAZIONI]: 'Telecomunicazioni',
  [CategoriaSpesa.INTERNET_HOSTING]: 'Internet e Hosting',
  [CategoriaSpesa.MATERIALI_DENTALI]: 'Materiali Dentali',
  [CategoriaSpesa.APPARECCHIATURE_MEDICHE]: 'Apparecchiature Mediche',
  [CategoriaSpesa.FARMACEUTICI]: 'Farmaceutici',
  [CategoriaSpesa.LEASING_FINANZIARIO]: 'Leasing Finanziario',
  [CategoriaSpesa.CONSULENZE_PROFESSIONALI]: 'Consulenze Professionali',
  [CategoriaSpesa.SERVIZI_BANCARI]: 'Servizi Bancari',
  [CategoriaSpesa.MANUTENZIONI_RIPARAZIONI]: 'Manutenzioni e Riparazioni',
  [CategoriaSpesa.ASSICURAZIONI]: 'Assicurazioni',
  [CategoriaSpesa.FORMAZIONE_AGGIORNAMENTO]: 'Formazione e Aggiornamento',
  [CategoriaSpesa.TASSE_IMPOSTE]: 'Tasse e Imposte',
  [CategoriaSpesa.AFFITTI_LOCAZIONI]: 'Affitti e Locazioni',
  [CategoriaSpesa.CARBURANTI]: 'Carburanti',
  [CategoriaSpesa.ALTRO]: 'Altro'
};

/**
 * Pattern per riconoscimento fornitori basato sui nomi
 */
export const FORNITORI_PATTERNS: Record<string, FornitorePattern> = {
  // Energia Elettrica
  'enel': {
    categoria: CategoriaSpesa.ENERGIA_ELETTRICA,
    confidence: 0.95,
    keywords: ['enel', 'energia spa', 'enel energia']
  },
  'edison': {
    categoria: CategoriaSpesa.ENERGIA_ELETTRICA,
    confidence: 0.95,
    keywords: ['edison', 'edison energia']
  },
  'empire_powergas': {
    categoria: CategoriaSpesa.ENERGIA_ELETTRICA,
    confidence: 0.9,
    keywords: ['empire powergas', 'powergas']
  },
  
  // Telecomunicazioni
  'wind_tre': {
    categoria: CategoriaSpesa.TELECOMUNICAZIONI,
    confidence: 0.95,
    keywords: ['wind tre', 'wind', 'tre s.p.a']
  },
  'vodafone': {
    categoria: CategoriaSpesa.TELECOMUNICAZIONI,
    confidence: 0.95,
    keywords: ['vodafone', 'vodafone italia']
  },
  'tim': {
    categoria: CategoriaSpesa.TELECOMUNICAZIONI,
    confidence: 0.95,
    keywords: ['tim s.p.a', 'telecom italia', 'tim ']
  },
  'fastweb': {
    categoria: CategoriaSpesa.TELECOMUNICAZIONI,
    confidence: 0.95,
    keywords: ['fastweb']
  },
  
  // Acqua e Utenze
  'publiacqua': {
    categoria: CategoriaSpesa.ACQUA_UTENZE,
    confidence: 0.95,
    keywords: ['publiacqua']
  },
  'acea': {
    categoria: CategoriaSpesa.ACQUA_UTENZE,
    confidence: 0.95,
    keywords: ['acea']
  },
  
  // Internet e Hosting
  'aruba': {
    categoria: CategoriaSpesa.INTERNET_HOSTING,
    confidence: 0.95,
    keywords: ['aruba s.p.a', 'aruba']
  },
  'amazon_web': {
    categoria: CategoriaSpesa.INTERNET_HOSTING,
    confidence: 0.9,
    keywords: ['amazon eu', 'amazon web services']
  },
  
  // Materiali Dentali
  'dentsply_sirona': {
    categoria: CategoriaSpesa.MATERIALI_DENTALI,
    confidence: 0.95,
    keywords: ['dentsply sirona', 'dentsply', 'sirona']
  },
  'henry_schein': {
    categoria: CategoriaSpesa.MATERIALI_DENTALI,
    confidence: 0.95,
    keywords: ['henry schein', 'krugg']
  },
  'zimmer_dental': {
    categoria: CategoriaSpesa.MATERIALI_DENTALI,
    confidence: 0.95,
    keywords: ['zimmer dental', 'zimmer']
  },
  'dental_generico': {
    categoria: CategoriaSpesa.MATERIALI_DENTALI,
    confidence: 0.8,
    keywords: ['dental', 'implant', 'bludental', 'dentalcomm', 'futurimplant']
  },
  
  // Leasing Finanziario
  'bnp_paribas': {
    categoria: CategoriaSpesa.LEASING_FINANZIARIO,
    confidence: 0.95,
    keywords: ['bnp paribas', 'lease group', 'leasing solutions']
  },
  
  // Servizi Bancari/Pagamento
  'nexi': {
    categoria: CategoriaSpesa.SERVIZI_BANCARI,
    confidence: 0.95,
    keywords: ['nexi payments', 'nexi']
  },
  'compass_banca': {
    categoria: CategoriaSpesa.SERVIZI_BANCARI,
    confidence: 0.9,
    keywords: ['compass banca']
  },
  
  // Farmaceutici
  'farmacia': {
    categoria: CategoriaSpesa.FARMACEUTICI,
    confidence: 0.9,
    keywords: ['farmacia', 'medical devices', 'biaggini medical']
  }
};

/**
 * Pattern per riconoscimento categoria dalle descrizioni
 */
export const DESCRIZIONE_PATTERNS: Record<string, FornitorePattern> = {
  // Energia
  'energia_elettrica': {
    categoria: CategoriaSpesa.ENERGIA_ELETTRICA,
    confidence: 0.9,
    keywords: ['energia elettrica', 'bolletta luce', 'consumo elettrico', 'kwh', 'corrente elettrica', 'fornitura di energia elettrica']
  },
  'gas_metano': {
    categoria: CategoriaSpesa.GAS_METANO,
    confidence: 0.9,
    keywords: ['gas naturale', 'bolletta gas', 'consumo gas', 'metano', 'mc gas', 'fornitura gas']
  },
  
  // Servizi
  'telefono_internet': {
    categoria: CategoriaSpesa.TELECOMUNICAZIONI,
    confidence: 0.85,
    keywords: ['telefono', 'adsl', 'fibra', 'internet', 'linea telefonica', 'canone telefonico', 'decisione commerciale']
  },
  
  // Leasing
  'leasing_finanziario': {
    categoria: CategoriaSpesa.LEASING_FINANZIARIO,
    confidence: 0.95,
    keywords: ['locazione finanziaria', 'leasing', 'canone leasing', 'rata leasing', 'contratto di: locazione finanziaria']
  },
  
  // Tasse e Imposte
  'tasse_contributi': {
    categoria: CategoriaSpesa.TASSE_IMPOSTE,
    confidence: 0.9,
    keywords: ['contributo conai', 'tassa', 'imposta', 'iva', 'tributo', 'contributo']
  },
  
  // Consulenze
  'consulenze': {
    categoria: CategoriaSpesa.CONSULENZE_PROFESSIONALI,
    confidence: 0.85,
    keywords: ['consulenza', 'honorari', 'parcella', 'prestazione professionale']
  },
  
  // Formazione
  'formazione': {
    categoria: CategoriaSpesa.FORMAZIONE_AGGIORNAMENTO,
    confidence: 0.9,
    keywords: ['corso', 'formazione', 'congresso', 'seminario', 'aggiornamento']
  },
  
  // Manutenzioni
  'manutenzioni': {
    categoria: CategoriaSpesa.MANUTENZIONI_RIPARAZIONI,
    confidence: 0.85,
    keywords: ['manutenzione', 'riparazione', 'assistenza tecnica', 'intervento tecnico']
  }
};

/**
 * Pattern per riconoscimento categoria dai numeri documento
 */
export const DOCUMENTO_PATTERNS: Record<string, FornitorePattern> = {
  'bolletta_energia': {
    categoria: CategoriaSpesa.ENERGIA_ELETTRICA,
    confidence: 0.7,
    keywords: [],
    pattern: /^\d{10,}$/ // Numeri molto lunghi tipici delle bollette
  },
  'fattura_fpr': {
    categoria: CategoriaSpesa.MATERIALI_DENTALI,
    confidence: 0.6,
    keywords: [],
    pattern: /^FPR\s*\d+/ // Pattern FPR comune nei materiali dentali
  },
  'ricevuta_r': {
    categoria: CategoriaSpesa.TELECOMUNICAZIONI,
    confidence: 0.5,
    keywords: [],
    pattern: /^R\d{8,}/ // Pattern R + numero lungo
  }
};

export interface SpesaFornitore {
  codice_fornitore?: string;
  nome_fornitore?: string;
  descrizione?: string;
  numero_documento?: string;
  categoria?: number;
}

export interface CategorizzazioneResult {
  categoria: CategoriaSpesa;
  confidence: number;
  motivo: string;
  suggerimenti?: string[];
}

/**
 * Funzione principale per auto-categorizzare una spesa fornitore
 */
export function categorizzaSpesaFornitore(spesa: SpesaFornitore): CategorizzazioneResult {
  const risultati: Array<{categoria: CategoriaSpesa, confidence: number, motivo: string}> = [];
  
  // 1. Analizza il nome del fornitore
  if (spesa.nome_fornitore) {
    const nomeFornitore = spesa.nome_fornitore.toLowerCase().trim();
    
    for (const [key, pattern] of Object.entries(FORNITORI_PATTERNS)) {
      for (const keyword of pattern.keywords) {
        if (nomeFornitore.includes(keyword.toLowerCase())) {
          risultati.push({
            categoria: pattern.categoria,
            confidence: pattern.confidence,
            motivo: `Nome fornitore contiene "${keyword}"`
          });
          break;
        }
      }
    }
  }
  
  // 2. Analizza la descrizione
  if (spesa.descrizione) {
    const descrizione = spesa.descrizione.toLowerCase().trim();
    
    for (const [key, pattern] of Object.entries(DESCRIZIONE_PATTERNS)) {
      for (const keyword of pattern.keywords) {
        if (descrizione.includes(keyword.toLowerCase())) {
          risultati.push({
            categoria: pattern.categoria,
            confidence: pattern.confidence,
            motivo: `Descrizione contiene "${keyword}"`
          });
          break;
        }
      }
    }
  }
  
  // 3. Analizza il numero documento
  if (spesa.numero_documento) {
    const numeroDoc = spesa.numero_documento.trim();
    
    for (const [key, pattern] of Object.entries(DOCUMENTO_PATTERNS)) {
      if (pattern.pattern && pattern.pattern.test(numeroDoc)) {
        risultati.push({
          categoria: pattern.categoria,
          confidence: pattern.confidence,
          motivo: `Numero documento segue pattern ${key}`
        });
      }
    }
  }
  
  // 4. Determina la categoria finale
  if (risultati.length === 0) {
    return {
      categoria: CategoriaSpesa.ALTRO,
      confidence: 0,
      motivo: 'Nessun pattern riconosciuto',
      suggerimenti: [
        'Verifica manualmente il fornitore',
        'Aggiungi pattern personalizzati se necessario'
      ]
    };
  }
  
  // Raggruppa per categoria e calcola confidence totale
  const categorieGrouped = risultati.reduce((acc, r) => {
    if (!acc[r.categoria]) {
      acc[r.categoria] = { confidence: 0, motivi: [] };
    }
    acc[r.categoria].confidence = Math.max(acc[r.categoria].confidence, r.confidence);
    acc[r.categoria].motivi.push(r.motivo);
    return acc;
  }, {} as Record<CategoriaSpesa, {confidence: number, motivi: string[]}>);
  
  // Trova la categoria con confidence maggiore
  const categoriaFinale = Object.entries(categorieGrouped)
    .sort(([,a], [,b]) => b.confidence - a.confidence)[0];
  
  return {
    categoria: categoriaFinale[0] as CategoriaSpesa,
    confidence: categoriaFinale[1].confidence,
    motivo: categoriaFinale[1].motivi.join(', ')
  };
}

/**
 * Funzione per ottenere suggerimenti di miglioramento per la categorizzazione
 */
export function getSuggerimentiMiglioramento(spese: SpesaFornitore[]): string[] {
  const suggerimenti: Set<string> = new Set();
  
  const categorieNonRiconosciute = spese.filter(s => 
    categorizzaSpesaFornitore(s).categoria === CategoriaSpesa.ALTRO
  );
  
  if (categorieNonRiconosciute.length > 0) {
    // Analizza fornitori non categorizzati
    const fornitoriFrequenti = categorieNonRiconosciute
      .filter(s => s.nome_fornitore)
      .reduce((acc, s) => {
        const nome = s.nome_fornitore!.toLowerCase();
        acc[nome] = (acc[nome] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    const topFornitori = Object.entries(fornitoriFrequenti)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    if (topFornitori.length > 0) {
      suggerimenti.add(`Considera di aggiungere pattern per i fornitori frequenti: ${topFornitori.map(([nome]) => nome).join(', ')}`);
    }
    
    // Analizza descrizioni comuni
    const descrizioniComuni = categorieNonRiconosciute
      .filter(s => s.descrizione && s.descrizione.length > 5)
      .map(s => s.descrizione!.toLowerCase())
      .reduce((acc, desc) => {
        // Estrai parole significative
        const parole = desc.split(/\s+/).filter(p => p.length > 3);
        parole.forEach(parola => {
          acc[parola] = (acc[parola] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>);
    
    const parolePiuComuni = Object.entries(descrizioniComuni)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    if (parolePiuComuni.length > 0) {
      suggerimenti.add(`Parole chiave frequenti nelle descrizioni non categorizzate: ${parolePiuComuni.map(([parola]) => parola).join(', ')}`);
    }
  }
  
  return Array.from(suggerimenti);
}

/**
 * Funzione per esportare le categorizzazioni per review
 */
export function esportaCategorizzazioni(spese: SpesaFornitore[]): Array<SpesaFornitore & CategorizzazioneResult> {
  return spese.map(spesa => ({
    ...spesa,
    ...categorizzaSpesaFornitore(spesa)
  }));
}

/**
 * Statistiche di categorizzazione
 */
export function getStatisticheCategorizzazione(spese: SpesaFornitore[]) {
  const categorizzazioni = spese.map(s => categorizzaSpesaFornitore(s));
  
  const stats = categorizzazioni.reduce((acc, cat) => {
    if (!acc[cat.categoria]) {
      acc[cat.categoria] = { count: 0, avgConfidence: 0, totalConfidence: 0 };
    }
    acc[cat.categoria].count++;
    acc[cat.categoria].totalConfidence += cat.confidence;
    acc[cat.categoria].avgConfidence = acc[cat.categoria].totalConfidence / acc[cat.categoria].count;
    return acc;
  }, {} as Record<CategoriaSpesa, {count: number, avgConfidence: number, totalConfidence: number}>);
  
  const totaleSpese = spese.length;
  const speseRiconosciute = categorizzazioni.filter(c => c.categoria !== CategoriaSpesa.ALTRO).length;
  const percentualeRiconoscimento = totaleSpese > 0 ? (speseRiconosciute / totaleSpese) * 100 : 0;
  
  return {
    totaleSpese,
    speseRiconosciute,
    percentualeRiconoscimento: Math.round(percentualeRiconoscimento * 100) / 100,
    dettagliCategorie: Object.entries(stats).map(([categoria, stat]) => ({
      categoria: categoria as CategoriaSpesa,
      label: CATEGORIE_LABELS[categoria as CategoriaSpesa],
      count: stat.count,
      percentuale: Math.round((stat.count / totaleSpese) * 10000) / 100,
      confidenceMedia: Math.round(stat.avgConfidence * 100) / 100
    })).sort((a, b) => b.count - a.count)
  };
}