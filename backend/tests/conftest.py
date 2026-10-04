import os
import tempfile
from pathlib import Path

# Los tests locales deben permanecer aislados del backend/.env de Supabase.
for variable in ("SUPABASE_URL", "SUPABASE_JWKS_URL", "SUPABASE_JWT_AUDIENCE"):
    os.environ[variable] = ""
os.environ["DATABASE_URL"] = f"sqlite:///{(Path(tempfile.gettempdir()) / f'salesia-tests-{os.getpid()}.sqlite3').as_posix()}"
os.environ["SECRET_KEY"] = "test-only-secret-key"
