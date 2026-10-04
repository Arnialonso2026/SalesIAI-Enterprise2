from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import RequestResponseEndpoint

from app.core.config import settings
from app.routers import analytics, auth, catalog, dashboard, realtime, sales, users
from app.seed import seed_demo_data
from app.services.realtime import realtime_hub


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
    description="API de operaciones comerciales y analítica de SalesIA Enterprise.",
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


@app.middleware("http")
async def broadcast_successful_changes(
    request: Request,
    call_next: RequestResponseEndpoint,
) -> Response:
    response = await call_next(request)
    user = getattr(request.state, "authenticated_user", None)
    successful_write = request.method in {"POST", "PUT", "PATCH", "DELETE"} and 200 <= response.status_code < 300
    if user is not None and (successful_write or getattr(request.state, "server_data_changed", False)):
        path = request.url.path
        resource_path = path.removeprefix(settings.api_v1_prefix).strip("/")
        resource = resource_path.split("/", maxsplit=1)[0] or "data"
        await realtime_hub.publish_change(user.company_id, resource, request.method.lower(), response.status_code)
    return response

app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(catalog.router, prefix=settings.api_v1_prefix)
app.include_router(sales.router, prefix=settings.api_v1_prefix)
app.include_router(dashboard.router, prefix=settings.api_v1_prefix)
app.include_router(users.router, prefix=settings.api_v1_prefix)
app.include_router(analytics.router, prefix=settings.api_v1_prefix)
app.include_router(realtime.router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["Estado"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "salesia-api"}
