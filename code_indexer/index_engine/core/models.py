from dataclasses import dataclass


@dataclass
class Symbol:
    name: str
    symbol_type: str
    file: str
    line: int
    language: str