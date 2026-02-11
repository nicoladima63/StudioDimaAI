"""
Script per ottenere Page Access Token da un User Access Token.
Uso: python get_page_token.py
"""

import requests
import sys

def get_page_tokens(user_access_token):
    """
    Ottiene i Page Access Token per tutte le pagine gestite dall'utente.

    Args:
        user_access_token: User Access Token con permesso pages_show_list

    Returns:
        Lista di pagine con i loro token
    """
    url = 'https://graph.facebook.com/v18.0/me/accounts'
    params = {
        'access_token': user_access_token
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()

        data = response.json()
        pages = data.get('data', [])

        if not pages:
            print("\nNessuna pagina trovata per questo account.")
            print("Assicurati che:")
            print("1. Il token abbia il permesso 'pages_show_list'")
            print("2. L'account gestisca almeno una pagina Facebook")
            return []

        print(f"\n✅ Trovate {len(pages)} pagine:\n")
        print("=" * 80)

        for idx, page in enumerate(pages, 1):
            print(f"\n{idx}. {page['name']}")
            print(f"   ID: {page['id']}")
            print(f"   Category: {page.get('category', 'N/A')}")
            print(f"   Page Access Token: {page['access_token'][:50]}...")
            print(f"   Full Token: {page['access_token']}")
            print("-" * 80)

        return pages

    except requests.exceptions.HTTPError as e:
        print(f"\n❌ Errore API: {e}")
        if e.response is not None:
            try:
                error_data = e.response.json()
                print(f"   Dettagli: {error_data.get('error', {}).get('message', str(e))}")
            except:
                pass
        return []

    except Exception as e:
        print(f"\n❌ Errore: {e}")
        return []


def main():
    print("=" * 80)
    print("Facebook Page Access Token Generator")
    print("=" * 80)

    print("\nCome ottenere un User Access Token:")
    print("1. Vai su https://developers.facebook.com/tools/explorer/")
    print("2. Seleziona la tua app 'StudioDimaAI'")
    print("3. Clicca 'Generate Access Token'")
    print("4. Autorizza con permesso 'pages_show_list'")
    print("5. Copia il token generato")

    user_token = input("\n📋 Incolla qui il User Access Token: ").strip()

    if not user_token:
        print("❌ Token non valido!")
        sys.exit(1)

    pages = get_page_tokens(user_token)

    if pages:
        print("\n✅ Operazione completata!")
        print("\nCosa fare ora:")
        print("1. Copia il 'Page Access Token' della pagina che vuoi usare")
        print("2. Vai in Social Media Settings nella tua app")
        print("3. Incolla il token nel campo 'Access Token' dell'account Facebook")
        print("4. Salva la configurazione")
        print("5. Clicca 'Verify Connection' per testare!")
    else:
        print("\n❌ Nessuna pagina trovata. Controlla i permessi del token.")


if __name__ == '__main__':
    main()
