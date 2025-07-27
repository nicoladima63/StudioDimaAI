from flask import Flask
from server.app.api import (
    api_auth, api_settings, api_richiami, api_prescrizione,
    api_pazienti, api_network, api_kpi, api_incassi,
    api_fatture, api_calendar, api_sms, api_templates, api_rentri,
    api_protocolli
)

def register_routes(app: Flask):
    blueprints = [
        api_auth.auth_bp,
        api_settings.settings_bp,
        api_richiami.recalls_bp,
        api_protocolli.protocolli_bp,
        api_prescrizione.prescrizione_bp,
        api_pazienti.pazienti_bp,
        api_network.network_bp,
        api_kpi.kpi_bp,
        api_incassi.incassi_bp,
        api_fatture.fatture_bp,
        api_calendar.calendar_bp,
        api_sms.sms_bp,
        api_templates.templates_bp,
        api_rentri.rentri_bp
    ]

    for bp in blueprints:
        if bp.name not in app.blueprints:
            app.register_blueprint(bp)
