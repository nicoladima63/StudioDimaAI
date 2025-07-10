from flask import Blueprint, jsonify
import os

network_bp = Blueprint('network', __name__)

@network_bp.route('/api/network/status', methods=['GET'])
def network_status():
    response = os.system("ping -n 1 SERVERDIMA >nul 2>&1")
    network_ok = (response == 0)
    share_ok = os.path.exists(r'\\SERVERDIMA\Pixel\WINDENT')
    return jsonify({
        'network': 'ok' if network_ok else 'unreachable',
        'share': 'ok' if share_ok else 'unreachable',
        'message': 'Stato rete e cartella condivisa verificato.'
    }) 