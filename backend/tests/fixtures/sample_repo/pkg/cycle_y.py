"""Circular dependency: cycle_x -> cycle_y -> cycle_z -> cycle_x."""

from pkg.cycle_z import z_func


def y_func() -> int:
    return z_func() + 1
