// Array di colori automatici per serie come nei grafici
export const COLORI_SERIE = [
  '#FF6384', // Rosa
  '#36A2EB', // Blu
  '#FFCE56', // Giallo
  '#4BC0C0', // Teal
  '#9966FF', // Viola
  '#FF9F40', // Arancione
  '#FF6B6B', // Rosa chiaro
  '#C9CBCF', // Grigio
  '#4ECDC4', // Verde acqua
  '#45B7D1', // Blu chiaro
  '#96CEB4', // Verde menta
  '#FFEAA7', // Giallo chiaro
  '#DDA0DD', // Prugna
  '#98D8C8', // Menta
  '#F7DC6F'  // Oro
];

/**
 * Ottiene un colore dalla serie in base all'indice del gruppo
 * @param index Indice del gruppo (0-based)
 * @returns Colore esadecimale
 */
export const getColoreSerieByIndex = (index: number): string => {
  return COLORI_SERIE[index % COLORI_SERIE.length];
};

/**
 * Genera una mappa di colori per un array di gruppi
 * @param gruppi Array di stringhe (nomi gruppi)
 * @returns Record con nome gruppo -> colore
 */
export const generaMappaColori = (gruppi: string[]): Record<string, string> => {
  const mappa: Record<string, string> = {};
  gruppi.forEach((gruppo, index) => {
    mappa[gruppo] = getColoreSerieByIndex(index);
  });
  return mappa;
};