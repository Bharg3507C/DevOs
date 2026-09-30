"""Module B: middle of the A -> B -> C dependency chain."""

from pkg.c import c_function


def b_function(value: int) -> int:
    return c_function(value) * 2
