import pandas as pd
import logging
from server.app.config.constants import COLONNE

logger = logging.getLogger(__name__)

def get_pazienti_by_ids(df_anagrafica, lista_id_pazienti):
    """Restituisce i dati dei pazienti dati gli ID."""
    if not lista_id_pazienti:
        return pd.DataFrame()
    cols = COLONNE['pazienti']
    richieste = [cols['id'], cols['nome'], cols['cellulare'], cols['telefono']]
    if any(c not in df_anagrafica.columns for c in richieste):
        logger.error(f"Colonne mancanti in anagrafica: {richieste}")
        return pd.DataFrame()
    df_anagrafica[cols['id']] = df_anagrafica[cols['id']].astype(str).str.strip()
    lista_id_pazienti = [str(x).strip() for x in lista_id_pazienti]
    df_filtrati = df_anagrafica[df_anagrafica[cols['id']].isin(lista_id_pazienti)].copy()
    df_filtrati['nome_completo'] = df_filtrati[cols['nome']].fillna('').str.strip().str.title()
    df_filtrati['numero_contatto'] = ''
    mask_cell = df_filtrati[cols['cellulare']].notna() & (df_filtrati[cols['cellulare']].str.strip() != '')
    df_filtrati.loc[mask_cell, 'numero_contatto'] = df_filtrati.loc[mask_cell, cols['cellulare']]
    mask_fisso = (df_filtrati['numero_contatto'] == '') & df_filtrati[cols['telefono']].notna()
    df_filtrati.loc[mask_fisso, 'numero_contatto'] = df_filtrati.loc[mask_fisso, cols['telefono']]
    return df_filtrati[[cols['id'], 'nome_completo', 'numero_contatto']] 