import sys
import os

# Aggiungi la directory principale del progetto al PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

def debug_config():
    """Debug della configurazione"""
    
    # Simula il calcolo del project_root dal file config
    config_file_path = os.path.join(os.getcwd(), 'server', 'app', 'config', 'config.py')
    print(f"Config file path: {config_file_path}")
    
    # Calcola project_root come nel tuo config
    project_root = os.path.abspath(os.path.join(os.path.dirname(config_file_path), '..', '..', '..'))
    print(f"Project root calcolato: {project_root}")
    print(f"Directory corrente: {os.getcwd()}")
    
    # Calcola il percorso del database
    db_path = os.path.join(project_root, 'instance', 'users.db')
    db_uri = f"sqlite:///{db_path}"
    
    print(f"Database path: {db_path}")
    print(f"Database URI: {db_uri}")
    print(f"Database file exists: {os.path.exists(db_path)}")
    
    # Percorso del database che sappiamo funziona
    working_db_path = os.path.join(os.getcwd(), 'instance', 'users.db')
    print(f"Working DB path: {working_db_path}")
    print(f"Working DB exists: {os.path.exists(working_db_path)}")
    
    print(f"Paths are same: {os.path.samefile(db_path, working_db_path) if os.path.exists(db_path) and os.path.exists(working_db_path) else 'Cannot compare'}")

def test_with_corrected_config():
    """Test con configurazione corretta"""
    
    from server.app.run import create_app
    from server.app.extensions import db
    from server.app.models.user import User
    
    app = create_app()
    
    print(f"Original DB URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
    
    # Forza il percorso che sappiamo funziona
    working_db_path = os.path.join(os.getcwd(), 'instance', 'users.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{working_db_path}'
    
    print(f"Corrected DB URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
    
    with app.app_context():
        try:
            users = User.query.all()
            print(f"✅ SQLAlchemy funziona! Utenti: {len(users)}")
            for user in users:
                print(f"   - {user.username} ({user.role})")
                
        except Exception as e:
            print(f"❌ Errore: {e}")

if __name__ == "__main__":
    print("=== Debug configurazione ===")
    debug_config()
    
    print("\n=== Test con configurazione corretta ===")
    test_with_corrected_config()