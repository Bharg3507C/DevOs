"""Circular dependency: cycle_x -> cycle_y -> cycle_z -> cycle_x."""

from pkg.cycle_x import x_func


def z_func() -> int:
    # Import used inside the function to close the cycle.
    return 42 if x_func.__name__ else 0
