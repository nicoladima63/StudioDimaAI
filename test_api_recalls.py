#!/usr/bin/env python3
"""
Script per testare gli endpoint API dei richiami
"""

import requests
import json

BASE_URL = "http://localhost:5000/api"

def test_login():
    """Test login per ottenere token"""
    print("=== Test Login ===")
    
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        print(f"Response text: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('access_token')
            if token:
                print(f"✅ Login riuscito! Token: {token[:20]}...")
                return token
            else:
                print("❌ Token non trovato nella risposta")
                return None
        else:
            print(f"❌ Login fallito: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Errore durante il login: {str(e)}")
        return None

def test_recalls_endpoints(token):
    """Test degli endpoint richiami"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n=== Test Endpoint Richiami ===")
    
    # Test 1: Lista richiami
    print("\n1. Test GET /api/recalls/")
    response = requests.get(f"{BASE_URL}/recalls/", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Richiami trovati: {data.get('count', 0)}")
        if data.get('data'):
            print(f"Primo richiamo: {data['data'][0]}")
    else:
        print(f"❌ Errore: {response.text}")
    
    # Test 2: Statistiche
    print("\n2. Test GET /api/recalls/statistics")
    response = requests.get(f"{BASE_URL}/recalls/statistics", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Statistiche: {data.get('data', {})}")
    else:
        print(f"❌ Errore: {response.text}")
    
    # Test 3: Test endpoint
    print("\n3. Test GET /api/recalls/test")
    response = requests.get(f"{BASE_URL}/recalls/test", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Test completato: {data.get('message', '')}")
        print(f"Risultati: {data.get('test_results', {})}")
    else:
        print(f"❌ Errore: {response.text}")
    
    # Test 4: Export
    print("\n4. Test GET /api/recalls/export")
    response = requests.get(f"{BASE_URL}/recalls/export", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Export completato: {data.get('count', 0)} richiami")
    else:
        print(f"❌ Errore: {response.text}")

def test_without_auth():
    """Test senza autenticazione"""
    print("\n=== Test Senza Autenticazione ===")
    
    response = requests.get(f"{BASE_URL}/recalls/")
    print(f"Status: {response.status_code}")
    if response.status_code == 401:
        print("✅ Correttamente bloccato senza token")
    else:
        print(f"❌ Dovrebbe essere bloccato: {response.text}")

def main():
    """Funzione principale"""
    print("🚀 Iniziando test API Richiami...\n")
    
    # Test senza autenticazione
    test_without_auth()
    
    # Test con autenticazione
    token = test_login()
    if token:
        test_recalls_endpoints(token)
    
    print("\n✅ Test completati!")

if __name__ == "__main__":
    main() 