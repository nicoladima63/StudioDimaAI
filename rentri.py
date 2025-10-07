import os
import requests
import json
import argparse
from lxml import etree
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
# Base URLs for RENTRI API (from OpenAPI)
RENTRI_API_BASE_URL_PROD = "https://api.rentri.gov.it/dati-registri/v1.0"
RENTRI_API_BASE_URL_TEST = "https://demoapi.rentri.gov.it/dati-registri/v1.0" # Assuming a demo API base URL

# Token URLs
RENTRI_TOKEN_URL_PROD = os.getenv("RENTRI_TOKEN_URL_PROD", "https://api.rentri.gov.it/oauth2/token")
RENTRI_TOKEN_URL_TEST = os.getenv("RENTRI_TOKEN_URL_TEST", "https://demoapi.rentri.gov.it/oauth2/token") # Assuming a demo token URL

# Client credentials for authentication
CLIENT_ID_PROD = os.getenv("RENTRI_CLIENT_ID_PROD")
CLIENT_SECRET_PROD = os.getenv("RENTRI_CLIENT_SECRET_PROD")
CLIENT_ID_TEST = os.getenv("RENTRI_CLIENT_ID_TEST")
CLIENT_SECRET_TEST = os.getenv("RENTRI_CLIENT_SECRET_TEST")

# Paths to XSD files
REGISTRI_XSD_PATH = "rentri-registri-1.0.xsd"
MOVIMENTI_XSD_PATH = "rentri-movimenti-1.0.xsd"
COMMON_XSD_PATH = "rentri-common-1.0.xsd"
# NOTE: rentri-comuni-1.0.xsd was not found (404 error during fetch).
# This might impact full validation of rentri-registri-1.0.xsd.

# --- Functions ---

def authenticate(is_test: bool = False) -> str:
    """
    Authenticates with the RENTRI API using client credentials and returns an access token.
    """
    client_id = CLIENT_ID_TEST if is_test else CLIENT_ID_PROD
    client_secret = CLIENT_SECRET_TEST if is_test else CLIENT_SECRET_PROD
    token_url = RENTRI_TOKEN_URL_TEST if is_test else RENTRI_TOKEN_URL_PROD

    if not client_id or not client_secret:
        raise ValueError(f"RENTRI_CLIENT_ID_{'TEST' if is_test else 'PROD'} and RENTRI_CLIENT_SECRET_{'TEST' if is_test else 'PROD'} must be set in environment variables.")

    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret
    }

    print(f"Attempting to authenticate with {token_url} (Environment: {'TEST' if is_test else 'PROD'})...")
    try:
        response = requests.post(token_url, headers=headers, data=data)
        response.raise_for_status()  # Raise an exception for HTTP errors
        token_data = response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError("Access token not found in authentication response.")
        print("Authentication successful.")
        return access_token
    except requests.exceptions.RequestException as e:
        print(f"Authentication failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response status: {e.response.status_code}")
            print(f"Response body: {e.response.text}")
        raise

def build_xml_registro(data: dict) -> bytes:
    """
    Builds an XML string for a RENTRI movement based on the provided data
    and the rentri-movimenti-1.0.xsd schema.

    Args:
        data (dict): A dictionary containing the movement data.
                     Expected structure (simplified example based on XSD):
                     {
                         "Identificativo": {"Anno": 2024, "Progressivo": 1},
                         "DataOraMovimento": "2024-01-01T10:00:00Z",
                         "TipoMovimento": "CARICO",
                         "Quantita": {"Valore": 100.5, "UnitaMisura": "KG"},
                         "CodiceCER": "123456",
                         "StatoFisico": "SOLIDO",
                         "Destinazione": {"TipoDestinazione": "RECUPERO", "CodiceDestinazione": "R1"}
                     }
    Returns:
        bytes: The XML string as bytes.
    """
    # Define namespaces
    MOV_NS = "https://api.rentri.gov.it/schemas/rentri-movimenti-1.0"
    XS_NS = "http://www.w3.org/2001/XMLSchema"
    
    # Create the root element <Movimenti>
    root = etree.Element(f"{{{MOV_NS}}}Movimenti", nsmap={None: MOV_NS, "xs": XS_NS})

    # Create a single <Movimento> element (assuming one movement per XML for simplicity)
    movimento_elem = etree.SubElement(root, f"{{{MOV_NS}}}Movimento")

    # Populate elements based on the 'data' dictionary
    # Identificativo
    identificativo_elem = etree.SubElement(movimento_elem, f"{{{MOV_NS}}}Identificativo")
    etree.SubElement(identificativo_elem, f"{{{MOV_NS}}}Anno").text = str(data["Identificativo"]["Anno"])
    etree.SubElement(identificativo_elem, f"{{{MOV_NS}}}Progressivo").text = str(data["Identificativo"]["Progressivo"])

    # DataOraMovimento
    etree.SubElement(movimento_elem, f"{{{MOV_NS}}}DataOraMovimento").text = data["DataOraMovimento"]

    # TipoMovimento
    etree.SubElement(movimento_elem, f"{{{MOV_NS}}}TipoMovimento").text = data["TipoMovimento"]

    # Quantita
    quantita_elem = etree.SubElement(movimento_elem, f"{{{MOV_NS}}}Quantita")
    etree.SubElement(quantita_elem, f"{{{MOV_NS}}}Valore").text = str(data["Quantita"]["Valore"])
    etree.SubElement(quantita_elem, f"{{{MOV_NS}}}UnitaMisura").text = data["Quantita"]["UnitaMisura"]

    # CodiceCER
    etree.SubElement(movimento_elem, f"{{{MOV_NS}}}CodiceCER").text = data["CodiceCER"]

    # StatoFisico
    etree.SubElement(movimento_elem, f"{{{MOV_NS}}}StatoFisico").text = data["StatoFisico"]

    # Destinazione (simplified)
    destinazione_elem = etree.SubElement(movimento_elem, f"{{{MOV_NS}}}Destinazione")
    etree.SubElement(destinazione_elem, f"{{{MOV_NS}}}TipoDestinazione").text = data["Destinazione"]["TipoDestinazione"]
    if "CodiceDestinazione" in data["Destinazione"]:
        etree.SubElement(destinazione_elem, f"{{{MOV_NS}}}CodiceDestinazione").text = data["Destinazione"]["CodiceDestinazione"]

    # Add other elements as needed based on the full XSD and 'data' structure

    return etree.tostring(root, pretty_print=True, encoding='UTF-8', xml_declaration=True)

def validate_xml(xml_bytes: bytes, xsd_path: str) -> bool:
    """
    Validates an XML byte string against a given XSD schema file.

    Args:
        xml_bytes (bytes): The XML content as bytes.
        xsd_path (str): The path to the XSD schema file.

    Returns:
        bool: True if validation is successful, False otherwise.
    """
    try:
        # Load the XSD schema
        schema_root = etree.parse(xsd_path)
        schema = etree.XMLSchema(schema_root)

        # Parse the XML content
        xml_doc = etree.fromstring(xml_bytes)

        # Validate
        schema.assertValid(xml_doc)
        print(f"XML validated successfully against {xsd_path}.")
        return True
    except etree.XMLSyntaxError as e:
        print(f"XML is not well-formed: {e}")
        return False
    except etree.DocumentInvalid as e:
        print(f"XML validation failed against {xsd_path}: {e}")
        return False
    except FileNotFoundError:
        print(f"XSD schema file not found at {xsd_path}. Cannot validate.")
        return False
    except Exception as e:
        print(f"An unexpected error occurred during XML validation: {e}")
        return False

def sign_xml(xml_bytes: bytes, cert_path: str, key_path: str) -> bytes:
    """
    Digitally signs an XML byte string using the provided certificate and private key.
    This is a placeholder function. XML digital signing is complex and requires
    specific libraries like 'xmlsec' or 'signxml' and potentially system-level
    dependencies.

    Args:
        xml_bytes (bytes): The XML content as bytes.
        cert_path (str): Path to the public certificate file (e.g., .pem, .crt).
        key_path (str): Path to the private key file (e.g., .pem, .key).

    Returns:
        bytes: The signed XML content as bytes.
    """
    print("--- WARNING: XML Signing is a placeholder ---")
    print("XML digital signing is complex and requires proper configuration of 'xmlsec' or 'signxml'.")
    print("Ensure 'xmlsec' is correctly installed and configured with its system dependencies.")
    print(f"Attempting to sign XML using cert: {cert_path}, key: {key_path}")

    # Example using xmlsec (requires xmlsec1 library installed on the system)
    # from xmlsec.tree import add_signature
    # from xmlsec.keys import Key
    # from xmlsec.template import add_reference, add_transform, add_digest, add_key_info, add_x509_data, add_x509_cert
    #
    # root = etree.fromstring(xml_bytes)
    #
    # # Create a signature template
    # signature_node = add_signature(root, "sha256", "rsa-sha256")
    #
    # # Add a reference to the root element
    # ref = add_reference(signature_node, "sha256", uri="#_1") # Assuming root has id="_1" or similar
    # add_transform(ref, "enveloped")
    #
    # # Load key and cert
    # key = Key.from_file(key_path, format=Key.FormatPem)
    # add_key_info(signature_node)
    # add_x509_data(add_key_info(signature_node))
    # add_x509_cert(add_x509_data(add_key_info(signature_node)), cert_path, Key.FormatPem)
    #
    # # Sign the XML
    # signed_xml_doc = xmlsec.sign(signature_node, key)
    # return etree.tostring(signed_xml_doc, pretty_print=True, encoding='UTF-8', xml_declaration=True)

    # For now, return the original XML with a placeholder comment
    print("Returning unsigned XML with a placeholder comment for signing.")
    return b"<!-- XML SIGNATURE PLACEHOLDER -->\n" + xml_bytes


def send_movimenti(token: str, registro_id: str, signed_xml: bytes, is_test: bool = False) -> dict:
    """
    Sends the signed XML movement data to the RENTRI API.

    Args:
        token (str): The authentication token.
        registro_id (str): The ID of the register (e.g., "R1234567890").
        signed_xml (bytes): The digitally signed XML content as bytes.
        is_test (bool): Whether to use the test environment API base URL.

    Returns:
        dict: The JSON response from the RENTRI API.
    """
    api_base_url = RENTRI_API_BASE_URL_TEST if is_test else RENTRI_API_BASE_URL_PROD
    url = f"{api_base_url}/operatore/{registro_id}/movimenti"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/xml" # RENTRI API expects application/xml for this endpoint
    }

    print(f"Sending movements to {url} (Environment: {'TEST' if is_test else 'PROD'})...")
    try:
        response = requests.post(url, headers=headers, data=signed_xml)
        response.raise_for_status()
        print("Movements sent successfully.")
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Failed to send movements: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response status: {e.response.status_code}")
            print(f"Response body: {e.response.text}")
        raise

# --- CLI ---
def main():
    parser = argparse.ArgumentParser(description="RENTRI API CLI for sending movements.")
    parser.add_argument("--registro_id", default="test-operator", help="RENTRI register ID (default: test-operator).")
    parser.add_argument("--cert_path", help="Path to the public certificate file for XML signing.")
    parser.add_argument("--key_path", help="Path to the private key file for XML signing.")
    parser.add_argument("--test_mode", action="store_true", help="Run in test mode (uses dummy data and skips actual sending).")
    args = parser.parse_args()

    # Sample movement data
    sample_movement_data = {
        "Identificativo": {"Anno": 2024, "Progressivo": 1},
        "DataOraMovimento": "2024-01-01T10:00:00Z",
        "TipoMovimento": "CARICO",
        "Quantita": {"Valore": 100.5, "UnitaMisura": "KG"},
        "CodiceCER": "123456",
        "StatoFisico": "SOLIDO",
        "Destinazione": {"TipoDestinazione": "RECUPERO", "CodiceDestinazione": "R1"}
    }

    if args.test_mode:
        print("--- Running in TEST MODE ---")
        print("Skipping authentication and actual API call.")

        # Build XML
        print("Building sample XML...")
        xml_content = build_xml_registro(sample_movement_data)
        print("Generated XML:\n", xml_content.decode('utf-8'))

        # Validate XML
        print("Validating generated XML...")
        if validate_xml(xml_content, MOVIMENTI_XSD_PATH):
            print("XML is valid.")
        else:
            print("XML is NOT valid.")

        # Simulate signing
        print("Simulating XML signing...")
        signed_xml = sign_xml(xml_content, args.cert_path or "dummy_cert.pem", args.key_path or "dummy_key.pem")
        print("Simulated signed XML (first 200 chars):\n", signed_xml.decode('utf-8')[:200])
        print("--- TEST MODE COMPLETE ---")
        return

    # Non-test mode
    try:
        token = authenticate(is_test=args.test_mode)
        xml_content = build_xml_registro(sample_movement_data)
        print("Generated XML:\n", xml_content.decode('utf-8'))

        if not validate_xml(xml_content, MOVIMENTI_XSD_PATH):
            print("XML validation failed. Aborting.")
            return

        if not args.cert_path or not args.key_path:
            raise ValueError("Certificate and private key paths are required for XML signing in non-test mode.")
        signed_xml = sign_xml(xml_content, args.cert_path, args.key_path)
        response = send_movimenti(token, args.registro_id, signed_xml, is_test=args.test_mode)
        print("API Response:", json.dumps(response, indent=2))

    except Exception as e:
        print(f"An error occurred during the RENTRI process: {e}")


if __name__ == "__main__":
    main()
