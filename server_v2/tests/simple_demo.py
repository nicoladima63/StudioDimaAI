"""
Simple demonstration of StudioDimaAI Server V2 Infrastructure.
"""

import sys
import os
import tempfile
import sqlite3

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server_v2.core.config import Config
from server_v2.core.database_manager import DatabaseManager
from server_v2.utils.dbf_utils import clean_dbf_value, convert_bytes_to_string


def create_test_database():
    """Create a simple test database."""
    temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
    temp_db.close()
    
    conn = sqlite3.connect(temp_db.name)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE test_table (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            value INTEGER DEFAULT 0
        )
    """)
    
    cursor.execute("INSERT INTO test_table (name, value) VALUES (?, ?)", ("Test 1", 100))
    cursor.execute("INSERT INTO test_table (name, value) VALUES (?, ?)", ("Test 2", 200))
    
    conn.commit()
    conn.close()
    
    return temp_db.name


def test_database_manager():
    """Test the DatabaseManager."""
    print("Testing DatabaseManager...")
    
    db_path = create_test_database()
    config = Config(db_path=db_path, environment="test")
    
    try:
        with DatabaseManager(config) as db_manager:
            # Test basic query
            result = db_manager.execute_query(
                "SELECT COUNT(*) as count FROM test_table",
                fetch_one=True
            )
            print(f"Query result: {result['count']} records found")
            
            # Test transaction
            with db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO test_table (name, value) VALUES (?, ?)",
                    ("Transaction Test", 999)
                )
                print("Transaction completed successfully")
            
            # Show statistics
            stats = db_manager.get_statistics()
            print(f"Queries executed: {stats['queries_executed']}")
            print(f"Connections created: {stats['connections_created']}")
            
    finally:
        os.unlink(db_path)
    
    print("DatabaseManager test completed successfully!\n")


def test_dbf_utilities():
    """Test the DBF utilities."""
    print("Testing DBF utilities...")
    
    # Test value cleaning
    test_values = [
        b'  Test Bytes  ',
        '  Test String  ',
        None,
        123
    ]
    
    print("Value cleaning results:")
    for value in test_values:
        cleaned = clean_dbf_value(value, default='EMPTY')
        print(f"  {repr(value)} -> {repr(cleaned)}")
    
    # Test bytes conversion
    bytes_value = b'Test Bytes'
    converted = convert_bytes_to_string(bytes_value)
    print(f"Bytes conversion: {repr(bytes_value)} -> {repr(converted)}")
    
    print("DBF utilities test completed successfully!\n")


def main():
    """Run the demonstration."""
    print("StudioDimaAI Server V2 - Simple Demo")
    print("=" * 50)
    
    try:
        test_database_manager()
        test_dbf_utilities()
        
        print("All tests completed successfully!")
        print("The V2 infrastructure is working correctly!")
        
    except Exception as e:
        print(f"Demo failed with error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == '__main__':
    sys.exit(main())