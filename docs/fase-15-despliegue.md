# Fase 15 — Despliegue

## Arquitectura objetivo

- Supabase aloja PostgreSQL administrado.
- Render ejecuta la API FastAPI desde `backend/Dockerfile`.
- Vercel compila y sirve la aplicación Vite desde el directorio `frontend`.
- La autenticación continúa usando DNI y contraseña de Matrixflow; Supabase se usa como base de datos, no como proveedor de Auth.

## Configuración

### Supabase

1. Crear el proyecto y guardar la contraseña de la base de datos fuera del repositorio.
2. Copiar la URI de conexión del pooler de sesión, adecuada para conexiones IPv4 desde Render.
3. Configurar `DATABASE_URL` en Render usando el formato SQLAlchemy `postgresql+psycopg://...` y exigir SSL con `sslmode=require`.

No guardar la URI ni la contraseña en archivos del repositorio o en el frontend.

### Render

1. Crear un Blueprint desde el repositorio y seleccionar `render.yaml`.
2. El servicio usa el contexto `backend`, ejecuta el Dockerfile y verifica disponibilidad en `/health`.
3. Completar `DATABASE_URL` con la conexión de Supabase y `CORS_ORIGINS` con el origen HTTPS exacto de Vercel, sin barra final.
4. `SECRET_KEY` se genera desde el Blueprint. No reemplazarla por el valor de desarrollo.
5. Las migraciones Alembic se aplican al iniciar la API.

El Blueprint propone el plan gratuito de Render; se puede cambiar desde el archivo o panel según el uso y la disponibilidad requeridos.

### Vercel

1. Importar el mismo repositorio y establecer `frontend` como Root Directory.
2. Usar `npm run build` y `dist` como directorio de salida.
3. Definir `VITE_API_URL` como `https://<servicio-render>.onrender.com/api/v1` antes del build.
4. `frontend/vercel.json` devuelve las rutas de la SPA a `index.html`.

`VITE_API_URL` es pública y se incorpora al bundle; solo debe contener la URL pública de la API, nunca secretos.

## Verificación de aceptación

- `https://<servicio-render>.onrender.com/health` devuelve HTTP 200.
- `https://<servicio-render>.onrender.com/docs` carga la documentación de FastAPI.
- La aplicación de Vercel inicia sesión con DNI y contraseña y puede cargar el dashboard.
- Crear una venta actualiza el stock y genera su movimiento de inventario.
- La consola del navegador no muestra errores CORS ni solicitudes a `localhost`.
- WebSocket de tiempo real conecta a la API de Render bajo `wss://`.

## Estado

Configuración base preparada. La fase no se considera completada hasta que Render y Vercel se publiquen con las variables reales y pasen las verificaciones de aceptación anteriores.