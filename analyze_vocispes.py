#!/usr/bin/env python3
"""
Script per analizzare le descrizioni del file VOCISPES.DBF
Estrae pattern, parole chiave e categorie per la classificazione
"""

import os
import re
from collections import Counter
from dbfread import DBF

def analyze_descriptions():
    base_path = "server/windent/DATI"
    table_path = os.path.join(base_path, "VOCISPES.DBF")
    
    if not os.path.exists(table_path):
        print(f"Errore: tabella {table_path} non trovata")
        return
    
    print("=== ANALISI DESCRIZIONI VOCISPES.DBF ===\n")
    
    try:
        table = DBF(table_path, encoding='latin1')
        
        descriptions = []
        word_counter = Counter()
        
        # Raccogli tutte le descrizioni valide
        for record in table:
            desc = record.get('DB_VODESCR', '')
            if desc and isinstance(desc, str) and desc.strip():
                desc_clean = desc.strip().upper()
                descriptions.append(desc_clean)
                
                # Conta le parole (solo parole alfanumeriche di almeno 3 caratteri)
                words = re.findall(r'\b[A-Z]{3,}\b', desc_clean)
                word_counter.update(words)
        
        print(f"Totale descrizioni analizzate: {len(descriptions)}")
        print(f"Descrizioni uniche: {len(set(descriptions))}")
        print()
        
        # Mostra le parole più comuni (escluse quelle troppo generiche)
        generic_words = {'PER', 'CON', 'DEL', 'DELLA', 'DAL', 'ALL', 'ALLA', 'NEL', 'NELLA', 'DI', 
                        'DA', 'IN', 'SU', 'IL', 'LA', 'LE', 'LO', 'GLI', 'UN', 'UNA', 'UNO', 
                        'SONO', 'STATO', 'STATI', 'QUESTA', 'QUESTO', 'QUESTI', 'QUESTE',
                        'CHE', 'AND', 'THE', 'OF', 'TO', 'FOR', 'WITH', 'FROM', 'BY', 'AT'}
        
        filtered_words = {word: count for word, count in word_counter.items() 
                         if word not in generic_words and len(word) >= 3}
        
        print("=== TOP 50 PAROLE CHIAVE ===")
        for word, count in Counter(filtered_words).most_common(50):
            print(f"{word:20} - {count:4} occorrenze")
        
        print("\n=== ESEMPI PER CATEGORIA ===")
        
        # Categorie specifiche dentali
        categories = {
            'MATERIALI COMPOSITI': ['COMPOSITE', 'RESINA', 'LIGHT-CURE', 'FLOW'],
            'PROTESI E ORTODONZIA': ['PROTESI', 'ORTODONZIA', 'PLACCA', 'APPARECCHIO', 'BITE'],
            'IMPLANTOLOGIA': ['IMPIANTO', 'IMPLANT', 'FUTURIMPLANT', 'FIXTURE', 'VITE'],
            'MATERIALI MONOUSO/DPI': ['GUANTI', 'MASCHERINE', 'ROTOLO', 'MONOUSO', 'LATEX', 'NITRILE'],
            'ANESTESIA': ['ARTICAINA', 'LIDOCAINA', 'ANESTETICO', 'ANESTESIA', 'CARPULE'],
            'IGIENE E STERILIZZAZIONE': ['STERILIZZAZIONE', 'DISINFETTANTE', 'AUTOCLAVE', 'DETERGENTE'],
            'FARMACI': ['ANTIBIOTICO', 'ANTIDOLORIFICO', 'FARMACO', 'MEDICINALE'],
            'STRUMENTARIO': ['FRESA', 'CURETTE', 'SPECILLO', 'STRUMENTO', 'PINZA'],
            'RADIOLOGIA': ['LASTRA', 'RADIOGRAFIA', 'SENSOR', 'PELLICOLA'],
            'CONSERVATIVA': ['CEMENTO', 'ADESIVO', 'PRIMER', 'BONDING', 'RIEMPIMENTO'],
        }
        
        for category, keywords in categories.items():
            print(f"\n--- {category} ---")
            found_examples = []
            
            for desc in descriptions:
                if any(keyword in desc for keyword in keywords):
                    found_examples.append(desc)
                    if len(found_examples) >= 5:  # Limita a 5 esempi per categoria
                        break
            
            if found_examples:
                for i, example in enumerate(found_examples[:5], 1):
                    print(f"  {i}. {example[:70]}{'...' if len(example) > 70 else ''}")
            else:
                print("  Nessun esempio trovato")
        
        print("\n=== PATTERN DESCRIZIONI ===")
        
        # Analizza pattern comuni
        patterns = {
            'Codici prodotto (lettere+numeri)': r'\b[A-Z]{2,4}\d{3,6}[A-Z]?\b',
            'Numeri lotto': r'\bLOTTO[:\s]+[\w-]+',
            'Date': r'\b\d{2}[-/]\d{2}[-/]\d{4}\b',
            'Quantità con unità': r'\b\d+[.,]?\d*\s?(PZ|ML|L|KG|G|CM|MM)\b',
            'Percentuali': r'\b\d+[.,]?\d*\s?%',
            'Misure': r'\b\d+[.,]?\d*\s?[X×]\s?\d+[.,]?\d*'
        }
        
        for pattern_name, regex in patterns.items():
            matches = []
            for desc in descriptions[:1000]:  # Analizza solo i primi 1000 per velocità
                found = re.findall(regex, desc)
                matches.extend(found)
            
            if matches:
                print(f"\n{pattern_name}: {len(matches)} occorrenze")
                # Mostra alcuni esempi
                unique_matches = list(set(matches))[:10]
                for match in unique_matches:
                    print(f"  - {match}")
        
        # Esempi di descrizioni complete per tipologia
        print("\n=== ESEMPI DESCRIZIONI COMPLETE ===")
        
        sample_types = {
            'Brevi (prodotti semplici)': [d for d in descriptions if 10 <= len(d) <= 40],
            'Medie (con dettagli)': [d for d in descriptions if 40 < len(d) <= 80],
            'Lunghe (descrizioni complete)': [d for d in descriptions if len(d) > 80]
        }
        
        for sample_type, sample_list in sample_types.items():
            if sample_list:
                print(f"\n--- {sample_type} ---")
                for i, example in enumerate(sample_list[:5], 1):
                    print(f"  {i}. {example}")
        
    except Exception as e:
        print(f"Errore durante l'analisi: {e}")

if __name__ == "__main__":
    analyze_descriptions()