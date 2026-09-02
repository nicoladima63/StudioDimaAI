import argparse
import sys

from .index_engine.scanner import main as index
from .query_engine.engine import main as query

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='AI Code Knowledge Platform')
    subcommands = parser.add_subparsers(dest='command')
    index_parser = subcommands.add_parser('index', help='Index configured workspaces')
    index_parser.add_argument('--force', action='store_true', help='Reparse every source file')
    subcommands.add_parser('query', help='Build an agent context')
    args, remaining = parser.parse_known_args()

    if args.command == 'query':
        sys.argv = [sys.argv[0], *remaining]
        query()
    else:
        index(force=bool(getattr(args, 'force', False)))
