"""
Test runner for StudioDimaAI Server V2.

Runs all tests and provides comprehensive reporting.
"""

import unittest
import sys
import os
import time
import logging
from io import StringIO

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import test modules
from . import test_database_manager
from . import test_dbf_utils  
from . import test_base_repository


class TestResult(unittest.TestResult):
    """Custom test result class for detailed reporting."""
    
    def __init__(self):
        super().__init__()
        self.start_time = None
        self.test_results = []
        
    def startTest(self, test):
        super().startTest(test)
        self.start_time = time.time()
        
    def addSuccess(self, test):
        super().addSuccess(test)
        duration = time.time() - self.start_time
        self.test_results.append({
            'test': str(test),
            'status': 'PASS',
            'duration': duration
        })
        
    def addError(self, test, err):
        super().addError(test, err)
        duration = time.time() - self.start_time
        self.test_results.append({
            'test': str(test),
            'status': 'ERROR',
            'duration': duration,
            'error': self._exc_info_to_string(err, test)
        })
        
    def addFailure(self, test, err):
        super().addFailure(test, err)
        duration = time.time() - self.start_time
        self.test_results.append({
            'test': str(test),
            'status': 'FAIL',
            'duration': duration,
            'error': self._exc_info_to_string(err, test)
        })


def run_test_suite(verbosity=2):
    """
    Run the complete test suite for StudioDimaAI Server V2.
    
    Args:
        verbosity: Test output verbosity level
        
    Returns:
        TestResult object with detailed results
    """
    # Configure logging for tests
    logging.basicConfig(
        level=logging.WARNING,  # Reduce noise during tests
        format='%(levelname)s - %(name)s - %(message)s'
    )
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add test modules
    test_modules = [
        test_database_manager,
        test_dbf_utils,
        test_base_repository
    ]
    
    for module in test_modules:
        suite.addTests(loader.loadTestsFromModule(module))
    
    # Create custom test runner
    stream = StringIO()
    runner = unittest.TextTestRunner(
        stream=stream,
        verbosity=verbosity,
        resultclass=TestResult
    )
    
    print("=" * 70)
    print("StudioDimaAI Server V2 - Test Suite")
    print("=" * 70)
    print(f"Running {suite.countTestCases()} tests...")
    print()
    
    start_time = time.time()
    result = runner.run(suite)
    total_time = time.time() - start_time
    
    # Print results
    print(f"\nTest Results:")
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Skipped: {len(result.skipped) if hasattr(result, 'skipped') else 0}")
    print(f"Total time: {total_time:.2f} seconds")
    
    # Print detailed results if available
    if hasattr(result, 'test_results'):
        print("\nDetailed Results:")
        print("-" * 70)
        
        for test_result in result.test_results:
            status_color = {
                'PASS': '\033[92m',    # Green
                'FAIL': '\033[91m',    # Red
                'ERROR': '\033[91m'    # Red
            }.get(test_result['status'], '')
            reset_color = '\033[0m'
            
            print(f"{status_color}{test_result['status']:<6}{reset_color} "
                  f"{test_result['test']:<50} "
                  f"({test_result['duration']:.3f}s)")
            
            if 'error' in test_result:
                print(f"       Error: {test_result['error']}")
    
    # Print failures and errors
    if result.failures:
        print("\nFailures:")
        print("-" * 70)
        for test, traceback in result.failures:
            print(f"FAIL: {test}")
            print(traceback)
            print()
    
    if result.errors:
        print("\nErrors:")
        print("-" * 70)
        for test, traceback in result.errors:
            print(f"ERROR: {test}")
            print(traceback)
            print()
    
    # Success/failure summary
    if result.wasSuccessful():
        print("\033[92m✓ All tests passed!\033[0m")
        return_code = 0
    else:
        print("\033[91m✗ Some tests failed!\033[0m")
        return_code = 1
    
    print("=" * 70)
    
    return result, return_code


def run_specific_test(test_class, test_method=None):
    """
    Run a specific test class or method.
    
    Args:
        test_class: Test class name (e.g., 'TestDatabaseManager')
        test_method: Optional specific test method name
    """
    # Map class names to modules
    class_map = {
        'TestDatabaseManager': test_database_manager.TestDatabaseManager,
        'TestDatabaseManagerEdgeCases': test_database_manager.TestDatabaseManagerEdgeCases,
        'TestDbfUtilities': test_dbf_utils.TestDbfUtilities,
        'TestDbfProcessor': test_dbf_utils.TestDbfProcessor,
        'TestDbfUtilsErrorHandling': test_dbf_utils.TestDbfUtilsErrorHandling,
        'TestBaseRepository': test_base_repository.TestBaseRepository,
        'TestBaseRepositoryErrorHandling': test_base_repository.TestBaseRepositoryErrorHandling
    }
    
    if test_class not in class_map:
        print(f"Unknown test class: {test_class}")
        print(f"Available classes: {list(class_map.keys())}")
        return
    
    # Create test suite
    suite = unittest.TestSuite()
    
    if test_method:
        # Run specific method
        suite.addTest(class_map[test_class](test_method))
    else:
        # Run all methods in class
        loader = unittest.TestLoader()
        suite.addTests(loader.loadTestsFromTestCase(class_map[test_class]))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result


def main():
    """Main test runner entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='StudioDimaAI Server V2 Test Runner')
    parser.add_argument('--class', dest='test_class', help='Run specific test class')
    parser.add_argument('--method', dest='test_method', help='Run specific test method')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--quiet', '-q', action='store_true', help='Quiet output')
    
    args = parser.parse_args()
    
    # Determine verbosity
    verbosity = 2
    if args.verbose:
        verbosity = 3
    elif args.quiet:
        verbosity = 1
    
    if args.test_class:
        # Run specific test
        result = run_specific_test(args.test_class, args.test_method)
        return_code = 0 if result.wasSuccessful() else 1
    else:
        # Run full test suite
        result, return_code = run_test_suite(verbosity)
    
    sys.exit(return_code)


if __name__ == '__main__':
    main()