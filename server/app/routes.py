from flask import Flask
from server.app.api import (
    api_auth, api_settings, api_richiami, api_prescrizione,
    api_pazienti, api_network, api_kpi, api_incassi,
    api_fatture, api_calendar, api_sms
)

def register_routes(app: Flask):
    blueprints = [
        api_auth.auth_bp,
        api_settings.settings_bp,
        api_richiami.recalls_bp,
        api_prescrizione.prescrizione_bp,
        api_pazienti.pazienti_bp,
        api_network.network_bp,
        api_kpi.kpi_bp,
        api_incassi.incassi_bp,
        api_fatture.fatture_bp,
        api_calendar.calendar_bp,
        api_sms.sms_bp
    ]

    for bp in blueprints:
        if bp.name in app.blueprints:
            app.logger.warning(f"Blueprint già registrato: {bp.name}")
        else:
            app.register_blueprint(bp)
            app.logger.info(f"Blueprint registrato: {bp.name}")
