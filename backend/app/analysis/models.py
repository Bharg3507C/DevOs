"""Plain dataclasses describing parser output.

These are intentionally decoupled from the SQLAlchemy models so the parser is
pure, side-effect free, and easy to unit test. The ingestion service maps these
into ORM rows.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ParsedImport:
    module: str
    symbol: str | None = None
    alias: str | None = None
    is_relative: bool = False
    level: int = 0
    line: int = 0


@dataclass
class ParsedFunction:
    name: str
    qualified_name: str
    start_line: int
    end_line: int
    loc: int
    num_params: int
    cyclomatic_complexity: int
    is_async: bool = False
    is_method: bool = False
    is_test: bool = False


@dataclass
class ParsedClass:
    name: str
    start_line: int
    end_line: int
    base_classes: list[str] = field(default_factory=list)
    num_methods: int = 0


@dataclass
class ParsedFile:
    """The full static analysis of a single source file."""

    path: str
    language: str
    loc: int
    size_bytes: int
    content_hash: str
    is_test: bool = False
    functions: list[ParsedFunction] = field(default_factory=list)
    classes: list[ParsedClass] = field(default_factory=list)
    imports: list[ParsedImport] = field(default_factory=list)
    parse_error: str | None = None
