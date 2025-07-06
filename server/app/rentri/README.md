# Modulo RENTRI

Integrazione API RENTRI suddivisa per servizi: anagrafiche, dati_registri, formulari, ca_rentri, codifiche, vidimazione_formulari.

Struttura modulare: ogni servizio ha la propria sottocartella con routes, controller, service, schemas.

Tutte le variabili sensibili vanno gestite tramite file .env e caricate nei moduli con dotenv. 