import sys
import os
import logging

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'server_v2')))

# Setup basic logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

try:
    from services.spese_fornitori_service import spese_fornitori_service
    from core.config_manager import get_config
except ImportError as e:
    logger.error(f"Import Error: {e}")
    logger.error("Make sure you are running this script from the project root or adjust sys.path")
    sys.exit(1)

def test_aggregation(anno):
    logger.info(f"Testing Expense Aggregation for Year: {anno}")
    
    try:
        result = spese_fornitori_service.get_riepilogo_spese(anno)
        
        if not result.get('success', False):
            logger.error(f"Aggregation Failed: {result.get('error')}")
            return

        data = result.get('data', [])
        logger.info(f"Found {len(data)} suppliers with expenses.")
        logger.info(f"Grand Total: {result.get('grand_total')}")
        
        print("\n--- Top 5 Suppliers by Cost ---")
        for i, row in enumerate(data[:5]):
            print(f"{i+1}. Code: {row['codice_fornitore']} | Total: €{row['importo_totale']} ({row['numero_fatture']} inv)")
            
    except Exception as e:
        logger.error(f"Exception during aggregation test: {e}")

def test_production_analysis(start_date, end_date):
    logger.info(f"\nTesting Production Analysis from {start_date} to {end_date}")
    
    try:
        result = spese_fornitori_service.get_analisi_produzione_operatore(start_date, end_date)
        
        if not result.get('success', False):
            logger.error(f"Analysis Failed: {result.get('error')}")
            return

        data = result.get('data', [])
        logger.info(f"Found {len(data)} operators with production.")
        
        print("\n--- Operator Production ---")
        for op in data:
            print(f"Operator: {op['operatore']} | Total: €{op['totale_periodo']}")
            for branca in op['dettaglio_branche']:
                print(f"  - {branca['branca']}: €{branca['importo']} ({branca['percentuale']}%)")
            print("")
            
    except Exception as e:
        logger.error(f"Exception during production test: {e}")

if __name__ == "__main__":
    # Test Parameters
    TEST_YEAR = 2024
    START_DATE = "2024-01-01"
    END_DATE = "2024-12-31"
    
    logger.info("Starting Verification Script...")
    
    # Check if DB files exist (basic check)
    try:
        config = get_config()
        base_path = config.get(f"{config.get_mode().upper()}_DB_BASE_PATH")
        logger.info(f"Using DB Base Path: {base_path}")
    except Exception as e:
        logger.warning(f"Could not load config correctly: {e}")

    test_aggregation(TEST_YEAR)
    test_production_analysis(START_DATE, END_DATE)
    
    logger.info("\nVerification Complete.")
