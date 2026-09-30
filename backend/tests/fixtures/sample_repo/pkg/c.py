"""Module C: end of the A -> B -> C dependency chain.

Also contains a deliberately high-complexity function and an unused function to
exercise complexity and dead-code analysis in later phases.
"""


def c_function(value: int) -> int:
    return value + 3


def high_complexity(x: int) -> str:
    # Many decision points -> high cyclomatic complexity.
    if x > 100:
        result = "huge"
    elif x > 50:
        result = "big"
    elif x > 20:
        result = "medium"
    elif x > 10:
        result = "small"
    elif x > 0:
        result = "tiny"
    else:
        result = "non-positive"

    for i in range(x):
        if i % 2 == 0 and i % 3 == 0:
            result += "!"
        elif i % 5 == 0 or i % 7 == 0:
            result += "?"
    return result


def unused_function(a: int, b: int) -> int:
    """No other module imports or calls this. Candidate for dead-code detection."""
    return a - b
