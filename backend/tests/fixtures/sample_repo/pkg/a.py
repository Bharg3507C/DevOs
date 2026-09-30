"""Module A: start of the A -> B -> C dependency chain."""

from pkg.b import b_function


def a_function(value: int) -> int:
    return b_function(value) + 1
