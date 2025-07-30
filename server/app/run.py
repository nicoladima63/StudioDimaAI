import os
import logging
from flask import Flask, jsonify
from server.app.config.config import Config
from server.app.extensions import db, jwt, cors
from server.app.routes import register_routes
from typing import Optional
from dotenv import load_dotenv
from sqlalchemy import text

load_dotenv()

def configure_logging() -> None:
    log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
    log_dir = 'logs'
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, 'app.log')
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format='%(asctime)s %(levelname)s %(name)s %(message)s',
        handlers=[logging.StreamHandler(), logging.FileHandler(log_file)]
    )

def check_critical_config(app: Flask) -> None:
    for key in ['SQLALCHEMY_DATABASE_URI', 'JWT_SECRET_KEY']:
        if not app.config.get(key):
            raise RuntimeError(f"Config mancante: {key}")

def create_app(config_class: Optional[object] = Config) -> Flask:
    configure_logging()
    logger = logging.getLogger(__name__)
    app = Flask(__name__)
    app.config.from_object(config_class)

    check_critical_config(app)
    cors.init_app(app, resources={r"/api/*": {
        "origins": os.getenv("CORS_ORIGINS", "http://localhost:5173"),
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }})
    db.init_app(app)
    jwt.init_app(app)

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        logger.error(f"Token non valido: {error}")
        return jsonify({'success': False, 'error': f'Token non valido: {error}'}), 422
    
    # Test routes BEFORE blueprint registration
    @app.route('/test-before-bp')
    def test_before_blueprints():
        return {'message': 'Route added BEFORE blueprints!'}, 200

    register_routes(app)
    
    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}", exc_info=True)
        return jsonify({'error': 'Internal server error', 'details': str(error)}), 500
    
    # Test routes AFTER blueprint registration
    @app.route('/api/rentri-test')
    def rentri_direct_test():
        return {'message': 'Direct route works!'}, 200

    @app.route('/test-direct')
    def simple_direct_test():
        return {'message': 'Simple direct route works!'}, 200

    @app.route('/health')
    def health_check():
        try:
            # Verifica connessione DB
            db.session.execute(text('SELECT 1'))
            # Verifica presenza tabella user e conta utenti
            result = db.session.execute(text('SELECT COUNT(*) FROM user'))
            user_count = result.scalar()
            db_status = 'ok'
            details = {'user_count': user_count}
        except Exception as e:
            db_status = 'error'
            details = {'error': str(e)}
            app.logger.error(f"Health check DB error: {e}")
        return {'status': 'healthy', 'db': db_status, **details}, 200

    @app.route('/oauth-result')
    def oauth_result():
        from flask import request
        success = request.args.get('success', 'false').lower() == 'true'
        error = request.args.get('error', '')
        
        if success:
            html = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Autenticazione Completata</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
                    .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .success { color: #28a745; margin-bottom: 20px; }
                    .button { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
                    .button:hover { background: #0056b3; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1 class="success">✅ Autenticazione Google Completata!</h1>
                    <p>L'autenticazione con Google Calendar è stata completata con successo.</p>
                    <p>Puoi chiudere questa finestra e tornare all'applicazione.</p>
                    <a href="/" class="button">Torna all'Applicazione</a>
                </div>
                <script>
                    // Chiudi automaticamente la finestra se è una popup
                    if (window.opener) {
                        setTimeout(() => {
                            window.close();
                        }, 3000);
                    }
                </script>
            </body>
            </html>
            """
        else:
            html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Errore Autenticazione</title>
                <style>
                    body {{ font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }}
                    .container {{ max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                    .error {{ color: #dc3545; margin-bottom: 20px; }}
                    .button {{ background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }}
                    .button:hover {{ background: #0056b3; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <h1 class="error">❌ Errore Autenticazione</h1>
                    <p>Si è verificato un errore durante l'autenticazione con Google.</p>
                    <p><strong>Errore:</strong> {error}</p>
                    <p>Riprova dall'applicazione principale.</p>
                    <a href="/" class="button">Torna all'Applicazione</a>
                </div>
                <script>
                    // Chiudi automaticamente la finestra se è una popup
                    if (window.opener) {{
                        setTimeout(() => {{
                            window.close();
                        }}, 5000);
                    }}
                </script>
            </body>
            </html>
            """
        
        return html

    # Route per servire l'applicazione React
    @app.route('/')
    def serve_react_app():
        from flask import send_from_directory
        static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
        return send_from_directory(static_path, 'index.html')

    @app.route('/<path:path>')
    def serve_react_static(path):
        from flask import send_from_directory
        static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
        # Se il file esiste nella cartella static, servilo
        if os.path.exists(os.path.join(static_path, path)):
            return send_from_directory(static_path, path)
        # Altrimenti, servi index.html per il routing lato client
        else:
            return send_from_directory(static_path, 'index.html')

    # logger.info("Applicazione inizializzata")

    return app

if __name__ == "__main__":
    app = create_app()

    # print("DEBUG: Lista completa delle regole registrate:")
    # for rule in app.url_map.iter_rules():
    #     print(f"  {rule} -> {rule.endpoint}")
    #     if 'rentri' in str(rule):
    #         print(f"    RENTRI route found: {rule.methods} {rule}")
    
    # print(f"DEBUG: Blueprints registrati: {list(app.blueprints.keys())}")
    # if 'rentri' in app.blueprints:
    #     print(f"SUCCESS: Blueprint RENTRI trovato in app.blueprints")
    # else:
    #     print(f"ERROR: Blueprint RENTRI NON trovato in app.blueprints")
    try:
        from waitress import serve
        host = app.config.get("HOST", "0.0.0.0")
        port = app.config.get("PORT", 5000)
        print(f"🚀 Server Waitress avviato su http://{host}:{port}")
        serve(app, host=host, port=port, threads=6)
    except Exception as e:
        logging.error(f"Errore durante l'esecuzione del server: {str(e)}")
        raise
