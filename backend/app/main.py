from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, catalog, dashboard, sales, users
from app.seed import seed_demo_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    backend_dir = Path(__file__).resolve().parents[1]
    migration_config = Config(str(backend_dir / "alembic.ini"))
    migration_config.set_main_option("script_location", str(backend_dir / "migrations"))
    command.upgrade(migration_config, "head")
    seed_demo_data()
    yield


app = FastAPI(
    title=settings.app_name,
    description="API para clientes, productos, ventas, pagos e inventario de SalesIA Enterprise.",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(catalog.router, prefix=settings.api_v1_prefix)
app.include_router(sales.router, prefix=settings.api_v1_prefix)
app.include_router(dashboard.router, prefix=settings.api_v1_prefix)
app.include_router(users.router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["Estado"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "salesia-api"}
