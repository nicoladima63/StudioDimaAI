"""
Debug routes registrate nel server v2.
"""

import sys
import os

# Aggiunge il path per importare i moduli
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from app_v2 import create_app_v2

def debug_routes():
    """Mostra tutte le routes registrate."""
    
    print("=== Creating Flask App ===")
    app = create_app_v2('development')
    
    print("\n=== Registered Routes ===")
    
    with app.app_context():
        for rule in app.url_map.iter_rules():
            methods = ','.join(rule.methods - {'HEAD', 'OPTIONS'})
            print(f"{rule.rule:<50} {methods:<15} -> {rule.endpoint}")
    
    print(f"\nTotal routes: {len(list(app.url_map.iter_rules()))}")

if __name__ == "__main__":
    debug_routes()