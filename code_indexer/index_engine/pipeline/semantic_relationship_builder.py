import re


ROUTE_PATTERN = re.compile(
    r"@[^\n]*?\.route\(\s*['\"](?P<route>[^'\"]+)['\"][^\n]*\)"
    r"[\s\S]{0,500}?^\s*def\s+(?P<name>\w+)\s*\(",
    re.MULTILINE,
)
HTTP_CALL_PATTERN = re.compile(
    r"\b(?:apiClient|api)\.(?P<method>get|post|put|patch|delete)\(\s*['\"](?P<route>[^'\"]+)",
    re.IGNORECASE,
)
# A database relation is valid only when the statement is inside a source-code
# string literal. This deliberately excludes calls such as ``updateWork()``.
SQL_LITERAL_PATTERN = re.compile(
    r"(?:\b[rfbu]{0,2})?(?P<quote>'''|\"\"\"|'|\")(?P<sql>[\s\S]*?)(?P=quote)",
    re.IGNORECASE,
)
SQL_PATTERNS = (
    ('reads', 'SELECT', re.compile(r"\bSELECT\b[\s\S]{0,500}?\bFROM\s+(?P<table>[A-Za-z_][\w.]*)", re.IGNORECASE)),
    ('writes', 'INSERT INTO', re.compile(r"^\s*INSERT\s+INTO\s+(?P<table>[A-Za-z_][\w.]*)", re.IGNORECASE)),
    ('writes', 'UPDATE', re.compile(r"^\s*UPDATE\s+(?P<table>[A-Za-z_][\w.]*)\s+SET\b", re.IGNORECASE)),
    ('writes', 'DELETE FROM', re.compile(r"^\s*DELETE\s+FROM\s+(?P<table>[A-Za-z_][\w.]*)", re.IGNORECASE)),
)


def _entity_for_line(entities, path, line):
    candidates = [entity for entity in entities if entity['path'] == path and entity['line'] <= line]
    return max(candidates, key=lambda entity: entity['line'], default=None)


def _iter_sql_statements(content):
    """Yield only SQL statements stored as Python/TypeScript string literals."""
    for literal in SQL_LITERAL_PATTERN.finditer(content):
        sql = literal.group('sql')
        normalized = sql.lstrip().upper()
        if normalized.startswith(('SELECT ', 'INSERT ', 'UPDATE ', 'DELETE ', 'WITH ')):
            yield literal.start('sql'), sql


def build_semantic_relationships(files, entities, project_root):
    """Extract high-signal route and database relations from source code."""
    relationships = []
    seen = set()

    def add(source, relation, target, **metadata):
        key = (source, relation, target)
        if source and key not in seen:
            seen.add(key)
            relationships.append({'source': source, 'relation': relation, 'target': target, **metadata})

    for file in files:
        try:
            content = file.read_text(encoding='utf-8')
        except (OSError, UnicodeDecodeError):
            continue

        path = file.relative_to(project_root).as_posix()
        for match in ROUTE_PATTERN.finditer(content):
            entity = next((item for item in entities if item['path'] == path and item['name'] == match.group('name')), None)
            if entity:
                add(entity['id'], 'exposes_route', f"route:{match.group('route')}", method='http')

        for match in HTTP_CALL_PATTERN.finditer(content):
            line = content.count('\n', 0, match.start()) + 1
            entity = _entity_for_line(entities, path, line)
            source = entity['id'] if entity else f'file:{path}'
            add(source, 'calls_route', f"route:{match.group('route')}", method=match.group('method').upper())

        for sql_start, sql in _iter_sql_statements(content):
            for relation, statement, pattern in SQL_PATTERNS:
                for match in pattern.finditer(sql):
                    line = content.count('\n', 0, sql_start + match.start()) + 1
                    entity = _entity_for_line(entities, path, line)
                    source = entity['id'] if entity else f'file:{path}'
                    add(source, relation, f"database:{match.group('table')}", statement=statement)

    return relationships
