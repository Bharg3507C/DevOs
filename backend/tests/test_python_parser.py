"""Unit tests for the static Python parser."""

from __future__ import annotations

from app.analysis.python_parser import parse_python_source

SIMPLE = b'''
import os
import sys as system
from collections import OrderedDict
from .helpers import util
from ..pkg import thing


class Widget(Base, Mixin):
    def __init__(self, x):
        self.x = x

    def render(self):
        return self.x


def free_function(a, b, *args, **kwargs):
    return a + b
'''


def test_extracts_functions_classes_imports():
    pf = parse_python_source("app/widgets.py", SIMPLE)
    assert pf.language == "python"
    assert pf.parse_error is None

    class_names = {c.name for c in pf.classes}
    assert class_names == {"Widget"}
    widget = next(c for c in pf.classes if c.name == "Widget")
    assert widget.base_classes == ["Base", "Mixin"]
    assert widget.num_methods == 2

    fn_names = {f.name for f in pf.functions}
    assert {"__init__", "render", "free_function"} <= fn_names

    free = next(f for f in pf.functions if f.name == "free_function")
    # a, b, *args, **kwargs => 4 params
    assert free.num_params == 4
    assert free.is_method is False

    render = next(f for f in pf.functions if f.name == "render")
    assert render.is_method is True


def test_import_resolution_details():
    pf = parse_python_source("app/widgets.py", SIMPLE)
    modules = {(i.module, i.symbol, i.is_relative, i.level) for i in pf.imports}
    assert ("os", None, False, 0) in modules
    assert ("sys", None, False, 0) in modules
    assert ("collections", "OrderedDict", False, 0) in modules
    assert ("helpers", "util", True, 1) in modules
    assert ("pkg", "thing", True, 2) in modules


def test_cyclomatic_complexity_counts_branches():
    src = b'''
def f(x):
    if x > 0 and x < 10:
        return 1
    for i in range(x):
        if i:
            pass
    while x:
        x -= 1
    return 0
'''
    pf = parse_python_source("m.py", src)
    f = pf.functions[0]
    # base 1 + if + (and) + for + inner if + while = 6
    assert f.cyclomatic_complexity == 6


def test_syntax_error_is_captured_not_raised():
    pf = parse_python_source("bad.py", b"def broken(:\n    pass\n")
    assert pf.parse_error is not None
    assert pf.functions == []
    assert pf.classes == []


def test_test_file_and_function_detection():
    pf = parse_python_source("tests/test_thing.py", b"def test_it():\n    assert True\n")
    assert pf.is_test is True
    assert pf.functions[0].is_test is True
