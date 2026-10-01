import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import get_settings
get_settings.cache_clear()
s = get_settings()
print(f"workdir field:    {repr(s.workdir)}")
print(f"resolved_workdir: {repr(s.resolved_workdir)}")
print(f"is absolute:      {Path(s.resolved_workdir).is_absolute()}")
print(f"github_oauth:     {s.github_oauth_configured}")

# Simulate what ingestion does
import os
from app.core.security import safe_join
root = Path(s.resolved_workdir)
root.mkdir(parents=True, exist_ok=True)
target = safe_join(root, "repo-99")
print(f"root:             {root}")
print(f"clone target:     {target}")
print(f"target is under root: {str(target).startswith(str(root))}")
