"""Static Python source parser built on the standard-library ``ast`` module.

Design constraints (see SECURITY.md):
- The parser only *parses* source. It never imports, compiles-to-run, or
  executes repository code. ``ast.parse`` builds a syntax tree without running
  anything.
- The parser is pure: given file bytes it returns a :class:`ParsedFile`. All
  persistence happens elsewhere.

Cyclomatic complexity is computed as ``1 + number of decision points`` where a
decision point is any branch/loop/boolean-operator/except/comprehension
condition. This is the standard McCabe approximation and is transparent and
reproducible.
"""

from __future__ import annotations

import ast
import hashlib

from app.analysis.models import (
    ParsedClass,
    ParsedFile,
    ParsedFunction,
    ParsedImport,
)

# AST node types that each add one to cyclomatic complexity.
_DECISION_NODES: tuple[type[ast.AST], ...] = (
    ast.If,
    ast.For,
    ast.AsyncFor,
    ast.While,
    ast.ExceptHandler,
    ast.With,
    ast.AsyncWith,
    ast.IfExp,
    ast.comprehension,
    ast.Assert,
)


def _content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _count_loc(source: str) -> int:
    """Count non-blank source lines."""
    return sum(1 for line in source.splitlines() if line.strip())


def _cyclomatic_complexity(node: ast.AST) -> int:
    """Compute McCabe cyclomatic complexity for a function subtree."""
    complexity = 1
    for child in ast.walk(node):
        if isinstance(child, _DECISION_NODES):
            complexity += 1
        elif isinstance(child, ast.BoolOp):
            # each additional operand in `a and b and c` adds a branch
            complexity += len(child.values) - 1
        elif isinstance(child, ast.Match):
            # each case (except a bare wildcard) is a branch
            complexity += len(child.cases)
    return complexity


def _is_test_file(path: str) -> bool:
    base = path.replace("\\", "/").rsplit("/", 1)[-1]
    return (
        base.startswith("test_")
        or base.endswith("_test.py")
        or "/tests/" in f"/{path.replace(chr(92), '/')}/"
    )


def _is_test_function(name: str) -> bool:
    return name.startswith("test_") or name.startswith("test")


class _Collector(ast.NodeVisitor):
    """Collect top-level and nested functions/classes with qualified names."""

    def __init__(self) -> None:
        self.functions: list[ParsedFunction] = []
        self.classes: list[ParsedClass] = []
        self._scope: list[str] = []

    def _end_line(self, node: ast.AST) -> int:
        return getattr(node, "end_lineno", None) or getattr(node, "lineno", 0)

    def _visit_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        is_method = bool(self._scope) and self._scope[-1][0].isupper()
        qualified = ".".join([*self._scope, node.name]) if self._scope else node.name
        args = node.args
        num_params = (
            len(args.posonlyargs)
            + len(args.args)
            + len(args.kwonlyargs)
            + (1 if args.vararg else 0)
            + (1 if args.kwarg else 0)
        )
        start = node.lineno
        end = self._end_line(node)
        self.functions.append(
            ParsedFunction(
                name=node.name,
                qualified_name=qualified,
                start_line=start,
                end_line=end,
                loc=max(1, end - start + 1),
                num_params=num_params,
                cyclomatic_complexity=_cyclomatic_complexity(node),
                is_async=isinstance(node, ast.AsyncFunctionDef),
                is_method=is_method,
                is_test=_is_test_function(node.name),
            )
        )
        self._scope.append(node.name)
        self.generic_visit(node)
        self._scope.pop()

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:  # noqa: N802
        self._visit_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:  # noqa: N802
        self._visit_function(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:  # noqa: N802
        bases = [ast.unparse(b) for b in node.bases] if node.bases else []
        methods = sum(
            1
            for c in node.body
            if isinstance(c, (ast.FunctionDef, ast.AsyncFunctionDef))
        )
        self.classes.append(
            ParsedClass(
                name=node.name,
                start_line=node.lineno,
                end_line=self._end_line(node),
                base_classes=bases,
                num_methods=methods,
            )
        )
        self._scope.append(node.name)
        self.generic_visit(node)
        self._scope.pop()


def _collect_imports(tree: ast.AST) -> list[ParsedImport]:
    imports: list[ParsedImport] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(
                    ParsedImport(
                        module=alias.name,
                        symbol=None,
                        alias=alias.asname,
                        is_relative=False,
                        level=0,
                        line=node.lineno,
                    )
                )
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            for alias in node.names:
                imports.append(
                    ParsedImport(
                        module=module,
                        symbol=alias.name,
                        alias=alias.asname,
                        is_relative=(node.level or 0) > 0,
                        level=node.level or 0,
                        line=node.lineno,
                    )
                )
    return imports


def parse_python_source(path: str, source_bytes: bytes) -> ParsedFile:
    """Parse Python source into a :class:`ParsedFile`.

    ``path`` is the repository-relative path (used for language/test detection
    and error reporting). ``source_bytes`` is the raw file content.

    On a syntax error the returned :class:`ParsedFile` has ``parse_error`` set
    and empty symbol lists, so a single bad file never aborts the whole run.
    """
    content_hash = _content_hash(source_bytes)
    size_bytes = len(source_bytes)
    is_test = _is_test_file(path)

    try:
        source = source_bytes.decode("utf-8")
    except UnicodeDecodeError:
        source = source_bytes.decode("utf-8", errors="replace")

    loc = _count_loc(source)

    try:
        tree = ast.parse(source, filename=path)
    except SyntaxError as exc:
        return ParsedFile(
            path=path,
            language="python",
            loc=loc,
            size_bytes=size_bytes,
            content_hash=content_hash,
            is_test=is_test,
            parse_error=f"SyntaxError: {exc.msg} (line {exc.lineno})",
        )

    collector = _Collector()
    collector.visit(tree)
    imports = _collect_imports(tree)

    return ParsedFile(
        path=path,
        language="python",
        loc=loc,
        size_bytes=size_bytes,
        content_hash=content_hash,
        is_test=is_test,
        functions=collector.functions,
        classes=collector.classes,
        imports=imports,
    )
