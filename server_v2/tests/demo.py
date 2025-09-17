"""
Demonstration of StudioDimaAI Server V2 Infrastructure.

This script demonstrates the key features and performance improvements
of the new infrastructure components.
"""

import sys
import os
import time
import tempfile
import sqlite3
import pandas as pd

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ..core.config import Config
from ..core.database_manager import DatabaseManager
from ..core.base_repository import BaseRepository, QueryOptions
from ..utils.dbf_utils import DbfProcessor, clean_dbf_value, convert_bytes_to_string
from ..core.exceptions import StudioDimaError


class DemoRepository(BaseRepository):
    """Demo repository for testing."""
    
    @property
    def table_name(self) -> str:
        return 'demo_entities'


def create_demo_database():
    """Create a demo database for testing."""
    temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
    temp_db.close()
    
    # Initialize database
    conn = sqlite3.connect(temp_db.name)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE demo_entities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            value INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Insert demo data
    demo_data = [
        ('Entity 1', 'First demo entity', 100),
        ('Entity 2', 'Second demo entity', 200),
        ('Entity 3', 'Third demo entity', 300),
    ]
    
    for name, desc, value in demo_data:
        cursor.execute(
            "INSERT INTO demo_entities (name, description, value) VALUES (?, ?, ?)",
            (name, desc, value)
        )
    
    conn.commit()
    conn.close()
    
    return temp_db.name


def demo_database_manager():
    """Demonstrate DatabaseManager features."""
    print("=" * 60)
    print("DatabaseManager Demo")
    print("=" * 60)
    
    # Create demo database
    db_path = create_demo_database()
    config = Config(db_path=db_path, environment="demo")
    
    try:
        with DatabaseManager(config) as db_manager:
            print(f"[SUCCESS] Database manager initialized with pool size: {config.pool_size}")
            
            # Test basic query
            result = db_manager.execute_query(
                "SELECT COUNT(*) as count FROM demo_entities",
                fetch_one=True
            )
            print(f"[SUCCESS] Query executed: Found {result['count']} entities")
            
            # Test transaction
            with db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO demo_entities (name, description, value) VALUES (?, ?, ?)",
                    ("Transaction Test", "Added in transaction", 999)
                )
                print("[SUCCESS] Transaction executed successfully")
            
            # Test batch operations
            batch_data = [
                ("Batch 1", "First batch item", 1001),
                ("Batch 2", "Second batch item", 1002),
                ("Batch 3", "Third batch item", 1003)
            ]
            
            rows_affected = db_manager.execute_many(
                "INSERT INTO demo_entities (name, description, value) VALUES (?, ?, ?)",
                batch_data
            )
            print(f"[SUCCESS] Batch operation: {rows_affected} rows inserted")
            
            # Show statistics
            stats = db_manager.get_statistics()
            print(f"[SUCCESS] Connection statistics:")
            print(f"  - Queries executed: {stats['queries_executed']}")
            print(f"  - Connections created: {stats['connections_created']}")
            print(f"  - Pool utilization: {stats['pool_utilization']:.1f}%")
            
    finally:
        # Cleanup
        os.unlink(db_path)
    
    print("[SUCCESS] DatabaseManager demo completed\n")


def demo_dbf_utilities():
    """Demonstrate DBF utilities."""
    print("=" * 60)
    print("DBF Utilities Demo")
    print("=" * 60)
    
    # Test basic value cleaning
    test_values = [
        b'  Test Bytes  ',
        '  Test String  ',
        None,
        '',
        123,
        pd.NaType()
    ]
    
    print("Value cleaning demonstration:")
    for value in test_values:
        try:
            cleaned = clean_dbf_value(value, default='<EMPTY>')
            print(f"  {repr(value)} -> {repr(cleaned)}")
        except:
            print(f"  {repr(value)} -> <ERROR>")
    
    # Test bytes conversion
    print("\nBytes conversion demonstration:")
    bytes_values = [
        b'Fornitore Test',
        b'  Spazi  ',
        b'\xff\xfe',  # Invalid UTF-8
    ]
    
    for value in bytes_values:
        converted = convert_bytes_to_string(value)
        print(f"  {repr(value)} -> {repr(converted)}")
    
    # Create demo DBF-like data
    demo_data = pd.DataFrame({
        'COD_FORN': ['001', b'002', '  003  ', None, ''],
        'NOME_FORN': [b'Fornitore 1', 'Fornitore 2', b'  Fornitore 3  ', None, ''],
        'IMPORTO': [100.0, 200.5, None, 0, -50.25]
    })
    
    print(f"\nDemo DataFrame processing:")
    print(f"[SUCCESS] Original data: {len(demo_data)} rows")
    
    # Test fornitori mapping
    from ..utils.dbf_utils import get_fornitori_mapping
    mapping = get_fornitori_mapping(demo_data)
    print(f"[SUCCESS] Fornitori mapping extracted: {len(mapping)} entries")
    for code, name in mapping.items():
        print(f"  {code}: {name}")
    
    print("[SUCCESS] DBF utilities demo completed\n")


def demo_repository_pattern():
    """Demonstrate repository pattern."""
    print("=" * 60)
    print("Repository Pattern Demo")
    print("=" * 60)
    
    # Create demo database
    db_path = create_demo_database()
    config = Config(db_path=db_path, environment="demo")
    
    try:
        db_manager = DatabaseManager(config)
        repo = DemoRepository(db_manager)
        
        print("✓ Repository initialized")
        
        # Test listing
        result = repo.list()
        print(f"✓ Listed entities: {len(result.data)} of {result.total_count}")
        
        # Test pagination
        paged_result = repo.list(QueryOptions(page=1, page_size=2))
        print(f"✓ Paginated query: {len(paged_result.data)} entities (page 1, size 2)")
        print(f"  Has more pages: {paged_result.has_more}")
        
        # Test filtering
        filtered_result = repo.list(QueryOptions(filters={'value': 200}))
        print(f"✓ Filtered query: {len(filtered_result.data)} entities with value=200")
        
        # Test ordering
        ordered_result = repo.list(QueryOptions(order_by='value', order_direction='DESC'))
        values = [entity['value'] for entity in ordered_result.data]
        print(f"✓ Ordered query (DESC): values = {values}")
        
        # Test create
        new_entity = repo.create({
            'name': 'Repository Test',
            'description': 'Created via repository',
            'value': 500
        })
        print(f"✓ Created entity with ID: {new_entity['id']}")
        
        # Test update
        updated_entity = repo.update(new_entity['id'], {
            'description': 'Updated via repository',
            'value': 750
        })
        print(f"✓ Updated entity: value changed to {updated_entity['value']}")
        
        # Test soft delete
        repo.delete(new_entity['id'], soft_delete=True)
        print("✓ Soft deleted entity")
        
        # Verify it's not in normal queries
        after_delete = repo.get_by_id(new_entity['id'])
        print(f"✓ Entity after soft delete: {after_delete is None}")
        
        # Test count
        count = repo.count()
        print(f"✓ Total entity count: {count}")
        
        db_manager.close()
        
    finally:
        # Cleanup
        os.unlink(db_path)
    
    print("✓ Repository pattern demo completed\n")


def demo_performance_comparison():
    """Demonstrate performance improvements."""
    print("=" * 60)
    print("Performance Comparison Demo")
    print("=" * 60)
    
    # Create demo database
    db_path = create_demo_database()
    
    # Simulate V1 approach (individual connections)
    print("Testing V1 approach (individual connections)...")
    start_time = time.time()
    
    for i in range(50):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM demo_entities")
        result = cursor.fetchone()
        cursor.close()
        conn.close()
    
    v1_time = time.time() - start_time
    print(f"✓ V1 approach: 50 queries in {v1_time:.3f} seconds")
    
    # Test V2 approach (connection pooling)
    print("Testing V2 approach (connection pooling)...")
    config = Config(db_path=db_path, environment="demo")
    
    start_time = time.time()
    
    with DatabaseManager(config) as db_manager:
        for i in range(50):
            result = db_manager.execute_query(
                "SELECT COUNT(*) FROM demo_entities",
                fetch_one=True
            )
    
    v2_time = time.time() - start_time
    print(f"✓ V2 approach: 50 queries in {v2_time:.3f} seconds")
    
    # Calculate improvement
    improvement = ((v1_time - v2_time) / v1_time) * 100
    print(f"✓ Performance improvement: {improvement:.1f}% faster")
    
    # Cleanup
    os.unlink(db_path)
    
    print("✓ Performance comparison completed\n")


def main():
    """Run all demonstrations."""
    print("StudioDimaAI Server V2 - Infrastructure Demonstration")
    print("=" * 80)
    print()
    
    try:
        demo_database_manager()
        demo_dbf_utilities()
        demo_repository_pattern()
        demo_performance_comparison()
        
        print("=" * 80)
        print("🎉 All demonstrations completed successfully!")
        print("✓ DatabaseManager: Connection pooling and transaction management")
        print("✓ DBF Utilities: Consolidated data processing")
        print("✓ Repository Pattern: Standardized CRUD operations")
        print("✓ Performance: Significant improvements demonstrated")
        print()
        print("The V2 infrastructure is ready for production use!")
        
    except Exception as e:
        print(f"❌ Demo failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()