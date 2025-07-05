import os
print("DEBUG: sto importando da", os.path.abspath(__file__))
import server.app.core.prescrizione_data as mod
print("DEBUG: attributi disponibili in prescrizione_data:", dir(mod))

from flask import Blueprint, request, jsonify
from server.app.core.prescrizione_data import cerca_diagnosi, cerca_farmaci

prescrizione_bp = Blueprint("prescrizione", __name__, url_prefix="/api")

@prescrizione_bp.route("/diagnosi")
def get_diagnosi():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify([])  # oppure errore 400
    risultati = cerca_diagnosi(query)
    return jsonify(risultati)

@prescrizione_bp.route("/farmaci")
def get_farmaci():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify([])
    risultati = cerca_farmaci(query)
    return jsonify(risultati)
