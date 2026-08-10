from dataclasses import dataclass, field


@dataclass
class QueryContext:

    query: str

    files: list = field(default_factory=list)

    symbols: list = field(default_factory=list)

    connections: list = field(default_factory=list)

    architecture: dict = field(default_factory=dict)

    core_symbols: list = field(default_factory=list)

    domain_symbols: list = field(default_factory=list)

    support_symbols: list = field(default_factory=list)

    internal_symbols: list = field(default_factory=list)