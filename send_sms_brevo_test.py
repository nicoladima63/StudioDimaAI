from server.app.services.sms_service import send_sms_brevo

if __name__ == "__main__":
    numero = "+393755445058"
    messaggio = "Test diretto Brevo: funziona il servizio SMS?"
    risultato = send_sms_brevo(numero, messaggio)
    print("Risultato invio SMS:", risultato) 