#!/usr/bin/env python3
"""
StudioDimaAI Server V2 - Modern Flask Server Entry Point.

This script launches the modernized StudioDimaAI server with improved
architecture, performance optimizations, and advanced features.

Usage:
    python run_v2.py
    python run_v2.py --config production
    python run_v2.py --port 5001 --debug
"""

import os
import sys
import argparse
import logging
from typing import Optional

# Add current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app_v2 import create_app_v2
from config.flask_config import get_config


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='StudioDimaAI Server V2 - Modern Flask Application'
    )
    
    parser.add_argument(
        '--config', '-c',
        choices=['development', 'production', 'testing'],
        default=os.environ.get('FLASK_ENV', 'development'),
        help='Configuration environment (default: development)'
    )
    
    parser.add_argument(
        '--host',
        default=os.environ.get('HOST', '0.0.0.0'),
        help='Host to bind to (default: 0.0.0.0)'
    )
    
    parser.add_argument(
        '--port', '-p',
        type=int,
        default=int(os.environ.get('PORT', 5001)),
        help='Port to bind to (default: 5001)'
    )
    
    parser.add_argument(
        '--debug', '-d',
        action='store_true',
        help='Enable debug mode'
    )
    
    parser.add_argument(
        '--threads',
        type=int,
        default=6,
        help='Number of threads for Waitress server (default: 6)'
    )
    
    parser.add_argument(
        '--use-waitress',
        action='store_true',
        default=True,
        help='Use Waitress WSGI server (recommended for production)'
    )
    
    parser.add_argument(
        '--use-flask-dev',
        action='store_true',
        help='Use Flask development server (not recommended for production)'
    )
    
    return parser.parse_args()


def setup_environment_variables(args):
    """Set up environment variables based on arguments."""
    os.environ['FLASK_ENV'] = args.config
    os.environ['HOST'] = args.host
    os.environ['PORT'] = str(args.port)
    
    if args.debug:
        os.environ['FLASK_DEBUG'] = 'true'


def validate_configuration(config_class):
    """Validate configuration before starting server."""
    required_settings = ['SECRET_KEY', 'JWT_SECRET_KEY']
    
    for setting in required_settings:
        if not getattr(config_class, setting, None):
            if config_class.__name__ == 'ProductionConfig':
                raise ValueError(f"Required setting '{setting}' not configured for production")
            else:
                logging.warning(f"Setting '{setting}' using default value (not recommended for production)")


from collections import defaultdict


def run_with_waitress(app, args):
    """Run server using Waitress WSGI server."""
    try:
        from waitress import serve
        
        print(f"Starting Waitress server on http://{args.host}:{args.port}")
        print("Press Ctrl+C to stop the server")
        print()
        
        serve(
            app,
            host=args.host,
            port=args.port,
            threads=args.threads,
            connection_limit=100,
            cleanup_interval=30,
            channel_timeout=120
        )
        
    except ImportError:
        print("❌ Waitress not installed. Install with: pip install waitress")
        print("🔄 Falling back to Flask development server...")
        run_with_flask_dev(app, args)
    except KeyboardInterrupt:
        print("\nServer stopped by user")
        # Shutdown scheduler
        try:
            from services.scheduler_service import scheduler_service
            print("🛑 Stopping scheduler service...")
            scheduler_service.shutdown()
            print("✅ Scheduler service stopped")
        except Exception as e:
            print(f"⚠️ Error stopping scheduler: {e}")
    except Exception as e:
        print(f"❌ Server error: {e}")
        # Shutdown scheduler on error
        try:
            from services.scheduler_service import scheduler_service
            scheduler_service.shutdown()
        except:
            pass
        sys.exit(1)


def run_with_flask_dev(app, args):
    """Run server using Flask development server."""
    print(f"WARNING: Using Flask development server (not recommended for production)")
    print(f"Starting Flask dev server on http://{args.host}:{args.port}")
    print("Press Ctrl+C to stop the server")
    print()
    
    try:
        app.run(
            host=args.host,
            port=args.port,
            debug=args.debug,
            threaded=True,
            use_reloader=False  # Disable reloader to avoid issues
        )
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")
        sys.exit(1)


def main():
    """Main entry point for the server."""
    try:
        # Parse command line arguments
        args = parse_arguments()
        
        # Set up environment variables
        setup_environment_variables(args)
        
        # Get configuration class
        config_class = get_config(args.config)
        
        # Validate configuration
        validate_configuration(config_class)
        
        # Create Flask application
        app = create_app_v2(args.config)
        
        # Initialize scheduler service
        from services.scheduler_service import scheduler_service
        print("🔄 Starting scheduler service...")
        scheduler_service.start()
        print("✅ Scheduler service started")
                
        # Start server
        if args.use_flask_dev:
            run_with_flask_dev(app, args)
        else:
            run_with_waitress(app, args)
            
    except KeyboardInterrupt:
        print("\n👋 Startup interrupted by user")
        sys.exit(0)
    except Exception as e:
        logging.error(f"Failed to start server: {e}", exc_info=True)
        print(f"ERROR Failed to start server: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()