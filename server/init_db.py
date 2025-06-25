# analytics/init_db.py
from app.run import create_app
from app.extensions import db
from app.auth.models import User
from app.auth.utils import hash_password

def init_database():
    """Inizializza il database con le tabelle e l'utente admin"""
    app = create_app()
    
    with app.app_context():
        # Elimina e ricrea tutte le tabelle
        print("Eliminando tabelle esistenti...")
        db.drop_all()
        
        print("Creando nuove tabelle...")
        db.create_all()
        
        # Crea utente admin
        print("Creando utente admin...")
        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            role="admin"
        )
        
        db.session.add(admin)
        db.session.commit()
        
        print("✅ Database inizializzato con successo!")
        print("👤 Utente admin creato - Username: admin, Password: admin123")
        
        # Verifica
        users = User.query.all()
        print(f"📊 Utenti nel database: {len(users)}")
        for user in users:
            print(f"   - {user.username} ({user.role})")

if __name__ == "__main__":
    init_database()