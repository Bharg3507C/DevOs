"""Diagnostic: check config and test a git clone to a temp path."""
import os, tempfile, subprocess, sys
from pathlib import Path

# Simulate production env (reads .env)
sys.path.insert(0, str(Path(__file__).parent))
from app.core.config import get_settings

s = get_settings()
print(f"workdir field:    {repr(s.workdir)}")
print(f"resolved_workdir: {repr(s.resolved_workdir)}")
print(f"github_oauth:     {s.github_oauth_configured}")
print(f"dev_login_active: {s.dev_login_active}")
print(f"environment:      {s.environment}")

# Test that we can create the workdir
from pathlib import Path as P
wd = P(s.resolved_workdir)
try:
    wd.mkdir(parents=True, exist_ok=True)
    print(f"workdir OK:       {wd}")
except Exception as e:
    print(f"workdir FAIL:     {e}")

# Test git is on PATH
r = subprocess.run(["git", "--version"], capture_output=True, text=True)
print(f"git version:      {r.stdout.strip() or r.stderr.strip()}")

# Check the DB for any failed jobs
os.environ.setdefault("DATABASE_URL", f"sqlite+pysqlite:///{Path(__file__).parent / 'devos_local.db'}")
from app.db.base import SessionLocal, init_db
init_db()
db = SessionLocal()
from app.models import AnalysisJob
jobs = db.query(AnalysisJob).order_by(AnalysisJob.id.desc()).limit(5).all()
print(f"\nLast {len(jobs)} analysis jobs:")
for j in jobs:
    print(f"  job {j.id}: status={j.status} error={repr(j.error)} files={j.files_processed}")
db.close()
