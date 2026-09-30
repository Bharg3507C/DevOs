"""Circular dependency: cycle_x -> cycle_y -> cycle_z -> cycle_x."""

from pkg.cycle_y import y_func


def x_func() -> int:
    return y_func() + 1
