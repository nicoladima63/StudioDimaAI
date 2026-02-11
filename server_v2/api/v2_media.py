"""
Media Upload API for Social Media Manager.
Handles file uploads for social media posts (images, videos).
"""
import os
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from flask_jwt_extended import jwt_required
from app_v2 import require_auth, format_response

logger = logging.getLogger(__name__)

media_v2_bp = Blueprint('media_v2', __name__)

# Configurazione upload
UPLOAD_FOLDER = os.path.join('uploads', 'socialmedia')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'mov'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

def allowed_file(filename):
    """Verifica se l'estensione del file è permessa."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_upload_folder():
    """Crea e ritorna la cartella upload se non esiste."""
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    return UPLOAD_FOLDER


@media_v2_bp.route('/social-media/upload-media', methods=['POST'])
@jwt_required()
def upload_media():
    """
    Upload di un file media (immagine/video) per social media post.

    Multipart form-data:
        file: File da uploadare (required)

    Returns:
        {
            success: True,
            data: {
                url: "/uploads/socialmedia/filename.jpg",
                filename: "filename.jpg",
                size: 12345
            }
        }
    """
    try:
        user_id = require_auth()

        # Verifica che ci sia un file
        if 'file' not in request.files:
            return format_response(
                success=False,
                error='Nessun file fornito',
                state='error'
            ), 400

        file = request.files['file']

        # Verifica che il file abbia un nome
        if file.filename == '':
            return format_response(
                success=False,
                error='Nome file vuoto',
                state='error'
            ), 400

        # Verifica estensione
        if not allowed_file(file.filename):
            return format_response(
                success=False,
                error=f'Estensione non permessa. Estensioni valide: {", ".join(ALLOWED_EXTENSIONS)}',
                state='error'
            ), 400

        # Genera nome file sicuro e unico
        original_filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        name, ext = os.path.splitext(original_filename)
        filename = f"{timestamp}_{name}{ext}"

        # Salva file
        upload_folder = get_upload_folder()
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)

        # Ottieni dimensione file
        file_size = os.path.getsize(filepath)

        # Verifica dimensione (dopo salvataggio per sicurezza)
        if file_size > MAX_FILE_SIZE:
            os.remove(filepath)  # Rimuovi file troppo grande
            return format_response(
                success=False,
                error=f'File troppo grande. Max: {MAX_FILE_SIZE // (1024*1024)}MB',
                state='error'
            ), 400

        # URL relativo per frontend (con prefisso API)
        media_url = f"/api/v2/uploads/socialmedia/{filename}"

        logger.info(f"User {user_id} uploaded media: {filename} ({file_size} bytes)")

        return format_response(
            data={
                'url': media_url,
                'filename': filename,
                'size': file_size,
                'original_name': original_filename
            },
            message='File caricato con successo',
            state='success'
        ), 201

    except Exception as e:
        logger.error(f"Error uploading media: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500


@media_v2_bp.route('/uploads/<path:filename>', methods=['GET'])
def serve_uploaded_file(filename):
    """
    Serve file uploadati.

    Path: /uploads/socialmedia/{filename}
    """
    try:
        # Determina la directory base assoluta (uploads/)
        base_upload_dir = os.path.abspath('uploads')

        # Normalizza il path del file (gestisce \ e / correttamente)
        safe_path = filename.replace('/', os.sep)

        # Security: assicurati che il path non esca dalla cartella uploads
        if '..' in safe_path or os.path.isabs(safe_path):
            logger.warning(f"Invalid path attempt: {filename}")
            return jsonify({'error': 'Invalid path'}), 403

        # Costruisci il path completo
        full_path = os.path.join(base_upload_dir, safe_path)

        # Verifica che il path finale sia dentro base_upload_dir
        if not os.path.abspath(full_path).startswith(base_upload_dir):
            logger.warning(f"Path traversal attempt: {filename}")
            return jsonify({'error': 'Invalid path'}), 403

        # Verifica che il file esista
        if not os.path.exists(full_path):
            logger.error(f"File not found: {full_path}")
            return jsonify({'error': 'File not found'}), 404

        # Estrai la directory e il filename per send_from_directory
        directory = os.path.dirname(full_path)
        file_name = os.path.basename(full_path)

        logger.info(f"Serving file: {file_name} from {directory}")
        return send_from_directory(directory, file_name)

    except FileNotFoundError:
        logger.error(f"FileNotFoundError for {filename}")
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        logger.error(f"Error serving file {filename}: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@media_v2_bp.route('/social-media/delete-media', methods=['DELETE'])
@jwt_required()
def delete_media():
    """
    Elimina un file media caricato.

    Body:
        filename: Nome del file da eliminare

    Returns:
        {success: True, message: "File eliminato"}
    """
    try:
        user_id = require_auth()
        data = request.get_json()

        if not data or 'filename' not in data:
            return format_response(
                success=False,
                error='Parametro filename richiesto',
                state='error'
            ), 400

        filename = secure_filename(data['filename'])
        filepath = os.path.join(get_upload_folder(), filename)

        if not os.path.exists(filepath):
            return format_response(
                success=False,
                error='File non trovato',
                state='warning'
            ), 404

        os.remove(filepath)
        logger.info(f"User {user_id} deleted media: {filename}")

        return format_response(
            message='File eliminato con successo',
            state='success'
        )

    except Exception as e:
        logger.error(f"Error deleting media: {e}", exc_info=True)
        return format_response(
            success=False,
            error=str(e),
            state='error'
        ), 500
