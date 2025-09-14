import os
import sys

# Add the current directory to sys.path to allow importing services
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from services.materiali_migration_service import MaterialiMigrationService

def debug_similarity():
    print("=== DEBUG SIMILARITY ALGORITHM ===")
    
    # Create a mock migration service just to test the similarity function
    class MockMigrationService:
        def _clean_material_name(self, name):
            if not name:
                return ""
            
            # Converti in lowercase e rimuovi spazi extra
            cleaned = str(name).lower().strip()
            
            # Rimuovi caratteri speciali comuni
            import re
            cleaned = re.sub(r'[^\w\s]', ' ', cleaned)
            
            # Rimuovi pattern comuni che non influenzano la classificazione
            cleaned = re.sub(r'\b\d+[x×]\d+\b', '', cleaned)
            cleaned = re.sub(r'\b\d+st\b', '', cleaned)
            cleaned = re.sub(r'\b\d+%\b', '', cleaned)
            cleaned = re.sub(r'\b\d+ml\b', '', cleaned)
            cleaned = re.sub(r'\b\d+cc\b', '', cleaned)
            cleaned = re.sub(r'\b\d+gr\b', '', cleaned)
            cleaned = re.sub(r'\b\d+mg\b', '', cleaned)
            
            # Rimuovi suffissi comuni
            cleaned = re.sub(r'\b(lt|refill|sterile|steril|r\d+|6x|sterile)\b', '', cleaned)
            
            # Rimuovi spazi multipli
            cleaned = re.sub(r'\s+', ' ', cleaned)
            
            return cleaned.strip()
        
        def _calculate_similarity(self, name1: str, name2: str) -> float:
            if not name1 or not name2:
                return 0.0
            
            # Match esatto
            if name1 == name2:
                return 1.0
            
            # Match parziale - controlla se uno contiene l'altro
            if name1 in name2 or name2 in name1:
                return 0.9
            
            # Similarità per parole chiave
            words1 = set(name1.split())
            words2 = set(name2.split())
            
            if not words1 or not words2:
                return 0.0
            
            # Calcola Jaccard similarity
            intersection = len(words1.intersection(words2))
            union = len(words1.union(words2))
            
            jaccard_score = intersection / union if union > 0 else 0.0
            
            # Bonus speciale per compositi con codici di colore diversi
            if ('composite' in name1 and 'composite' in name2 and 
                'universal' in name1 and 'universal' in name2):
                
                import re
                codes1 = set(re.findall(r'\b[a-z]+\d*[a-z]*\b', name1.lower()))
                codes2 = set(re.findall(r'\b[a-z]+\d*[a-z]*\b', name2.lower()))
                
                common_words = {'composite', 'universal', 'light', 'cure', 'resto', 'restorative'}
                codes1 = codes1 - common_words
                codes2 = codes2 - common_words
                
                if len(codes1) > 0 and len(codes2) > 0:
                    non_code_words1 = words1 - codes1
                    non_code_words2 = words2 - codes2
                    common_non_code = len(non_code_words1.intersection(non_code_words2))
                    
                    if common_non_code >= 3:
                        jaccard_score = max(jaccard_score, 0.85)
            
            return jaccard_score
    
    migration_service = MockMigrationService()
    
    # Test materials
    material1 = "UC001A3 Universal Light-Cure Composite Resto"
    material2 = "UC001C2 Universal Light-Cure Composite Resto"
    material3 = "UC001INC Universal Light-Cure Composite Resto"
    
    print(f"\nMateriale 1: {material1}")
    print(f"Materiale 2: {material2}")
    print(f"Materiale 3: {material3}")
    
    # Test similarity between material1 and material2
    print(f"\n--- Similarity between {material1} and {material2} ---")
    similarity_1_2 = migration_service._calculate_similarity(material1, material2)
    print(f"Similarity: {similarity_1_2}")
    
    # Test similarity between material1 and material3
    print(f"\n--- Similarity between {material1} and {material3} ---")
    similarity_1_3 = migration_service._calculate_similarity(material1, material3)
    print(f"Similarity: {similarity_1_3}")
    
    # Test similarity between material2 and material3
    print(f"\n--- Similarity between {material2} and {material3} ---")
    similarity_2_3 = migration_service._calculate_similarity(material2, material3)
    print(f"Similarity: {similarity_2_3}")
    
    # Debug the cleaning function
    print(f"\n--- DEBUG CLEANING FUNCTION ---")
    cleaned1 = migration_service._clean_material_name(material1)
    cleaned2 = migration_service._clean_material_name(material2)
    cleaned3 = migration_service._clean_material_name(material3)
    
    print(f"Cleaned 1: '{cleaned1}'")
    print(f"Cleaned 2: '{cleaned2}'")
    print(f"Cleaned 3: '{cleaned3}'")
    
    # Debug word extraction
    print(f"\n--- DEBUG WORD EXTRACTION ---")
    words1 = set(cleaned1.split())
    words2 = set(cleaned2.split())
    words3 = set(cleaned3.split())
    
    print(f"Words 1: {words1}")
    print(f"Words 2: {words2}")
    print(f"Words 3: {words3}")
    
    # Debug code extraction
    print(f"\n--- DEBUG CODE EXTRACTION ---")
    import re
    codes1 = set(re.findall(r'\b[a-z]+\d*[a-z]*\b', material1.lower()))
    codes2 = set(re.findall(r'\b[a-z]+\d*[a-z]*\b', material2.lower()))
    codes3 = set(re.findall(r'\b[a-z]+\d*[a-z]*\b', material3.lower()))
    
    common_words = {'composite', 'universal', 'light', 'cure', 'resto', 'restorative'}
    codes1_clean = codes1 - common_words
    codes2_clean = codes2 - common_words
    codes3_clean = codes3 - common_words
    
    print(f"Codes 1 (raw): {codes1}")
    print(f"Codes 1 (clean): {codes1_clean}")
    print(f"Codes 2 (raw): {codes2}")
    print(f"Codes 2 (clean): {codes2_clean}")
    print(f"Codes 3 (raw): {codes3}")
    print(f"Codes 3 (clean): {codes3_clean}")
    
    # Debug common words calculation
    print(f"\n--- DEBUG COMMON WORDS CALCULATION ---")
    non_code_words1 = words1 - codes1_clean
    non_code_words2 = words2 - codes2_clean
    non_code_words3 = words3 - codes3_clean
    
    print(f"Non-code words 1: {non_code_words1}")
    print(f"Non-code words 2: {non_code_words2}")
    print(f"Non-code words 3: {non_code_words3}")
    
    common_non_code_1_2 = len(non_code_words1.intersection(non_code_words2))
    common_non_code_1_3 = len(non_code_words1.intersection(non_code_words3))
    common_non_code_2_3 = len(non_code_words2.intersection(non_code_words3))
    
    print(f"Common non-code words 1-2: {common_non_code_1_2}")
    print(f"Common non-code words 1-3: {common_non_code_1_3}")
    print(f"Common non-code words 2-3: {common_non_code_2_3}")

if __name__ == '__main__':
    debug_similarity()
