# SalesIA Enterprise — Matrixflow-V2

> Plataforma web empresarial de gestión comercial. Este repositorio implementa las fases **01 a 08** del plan maestro adjunto; las fases 09 a 16 quedan como siguientes entregables.

## Qué incluye

- **Fases 01–03:** alcance y reglas de negocio documentadas, arquitectura modular y UI responsive.
- **Fase 04:** modelo PostgreSQL, migración Alembic y datos demo.
- **Fases 05–06:** API FastAPI con JWT y aplicación React + TypeScript.
- **Fase 07:** clientes, categorías y productos con búsqueda.
- **Fase 08:** punto de venta, cálculo de descuento e IGV, registro de pago e historial trazable de inventario.

## Arranque rápido (Docker)

Requisitos: Docker Desktop actualizado y puertos 5432, 8000 y 5173 disponibles. Si inicias la API fuera de Docker, copia `backend/.env.example` a `backend/.env` y configura `DATABASE_URL` y una `SECRET_KEY` segura. El frontend usa `VITE_API_URL` de `frontend/.env.local` si deseas cambiar la URL local por defecto.

Desde la raíz del proyecto:

```powershell
docker compose up --build
```

- Aplicación: http://localhost:5173
- API y documentación interactiva: http://localhost:8000/docs
- Estado de API: http://localhost:8000/health

La base de datos se inicializa automáticamente. Acceso demo: DNI **00000001** · contraseña **SalesIA2026!**.

## Arranque local sin Docker

Se necesita Python 3.11+, Node.js 20+ y PostgreSQL 16. Crear la base y usuario local `salesia`, copiar `backend/.env.example` a `backend/.env` y ajustar `DATABASE_URL` y `SECRET_KEY`.

Terminal backend (desde `backend/`):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Terminal frontend (desde `frontend/`):

```powershell
npm install
npm run dev
```

El frontend usa `http://localhost:8000/api/v1` por defecto; se puede cambiar con `VITE_API_URL`. Para aplicar migraciones manualmente: `cd backend; alembic upgrade head`.

## Estructura

```text
backend/
	app/                 FastAPI, modelos, esquemas, servicios, rutas y datos demo
	migrations/          Versiones Alembic
	tests/               Pruebas unitarias e integración
	pyproject.toml       Dependencias y configuración de pruebas
frontend/
	src/components/      Layout y controles reutilizables
	src/pages/           Resumen, usuarios, clientes, productos, categorías, ventas e inventario
	src/                 API HTTP, tipos, rutas y diseño responsive
docs/                  Entregables y criterios de aceptación de fases 01–08
docker-compose.yml     PostgreSQL + API + frontend para desarrollo local
Plan_Desarrollo_SalesIA_Enterprise.pdf
```

## Configuración y reglas operativas

Las variables principales están en `backend/.env.example`: `DATABASE_URL`, `SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `CORS_ORIGINS`, `COMPANY_NAME` y `TAX_RATE` (0.18 por defecto). La venta obtiene los precios desde el servidor, valida el stock, aplica el descuento antes del IGV y registra venta, pago y salidas de inventario en una misma transacción.

El usuario y los datos semilla son únicamente para demostración. **No desplegar con las claves de ejemplo**; configurar secreto aleatorio, credenciales y controles productivos antes de publicar.

### Usuarios, DNI y roles

El acceso de la aplicación es **DNI de 8 dígitos + contraseña**, validado por FastAPI y Argon2. El administrador crea usuarios desde **Usuarios**, asigna uno de los roles del plan (Administrador, Gerente, Vendedor, Analista o Almacén) y establece sus credenciales. Puede editar el DNI/rol, reemplazar o quitar una contraseña, desactivar la cuenta y eliminar su acceso. Al eliminar acceso se vacían DNI, correo y contraseña, pero se conserva la fila para mantener las referencias de ventas históricas. El último administrador activo y la propia cuenta no se pueden eliminar.

Los JWT de Supabase pueden seguir validándose en el backend con `SUPABASE_URL` y `SUPABASE_JWKS_URL`, si otros clientes los necesitan; ya no se usan para el formulario web de ingreso. La aplicación firma tokens locales de acceso con `SECRET_KEY`. La URL/JWKS no sustituye `DATABASE_URL`: para PostgreSQL de Supabase necesitas obtener también la cadena SQL/Pooler desde el panel. **No coloques `SUPABASE_SECRET_KEY` en el frontend.** Como esa clave se compartió en el chat, revócala en Supabase y genera otra; esta implementación de login DNI no la necesita.

## Pruebas y compilación

```powershell
cd backend
pip install -e ".[dev]"
pytest
cd ..\frontend
npm install
npm run build
```

## Plan maestro

El estado por fase y los criterios de entrega están en [docs/plan-maestro.md](docs/plan-maestro.md). La analítica de las fases 09–12 incluye estadísticas, dashboard, insights y exportación de reportes; sus contratos y criterios están documentados en `docs/fase-09` a `docs/fase-12`.
