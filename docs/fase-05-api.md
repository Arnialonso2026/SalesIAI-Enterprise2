# Fase 05 — Backend y contrato API

**Base local:** `http://localhost:8000` · **Prefijo REST:** `/api/v1` · **OpenAPI:** `/docs`

Las respuestas de listado son arreglos JSON. Los errores de validación/negocio usan `detail`; el token se envía en `Authorization: Bearer <token>`.

| Método | Ruta | Auth | Propósito |
|---|---|---|---|
| GET | `/health` | No | Comprobar disponibilidad |
| POST | `/api/v1/auth/login` | No | Validar DNI/contraseña y recibir JWT |
| GET | `/api/v1/auth/me` | Sí | Obtener perfil del usuario actual |
| GET / POST | `/api/v1/customers` | Sí | Buscar/listar y crear clientes |
| PUT | `/api/v1/customers/{id}` | Sí | Actualizar ficha del cliente |
| GET | `/api/v1/categories` | Sí | Listar categorías |
| GET / POST | `/api/v1/products` | Sí | Buscar/listar y crear productos |
| PUT | `/api/v1/products/{id}` | Sí | Actualizar ficha de catálogo (el stock se ajusta en inventario) |
| GET | `/api/v1/sales` | Sí | Consultar historial; acepta `search` |
| GET | `/api/v1/sales/{id}` | Sí | Consultar venta con artículos y pagos |
| POST | `/api/v1/sales` | Sí | Registrar operación comercial completa |
| GET | `/api/v1/inventory/movements` | Sí | Consultar los últimos movimientos |
| POST | `/api/v1/inventory/products/{id}/adjust` | Sí | Ajustar stock con cantidad con signo y motivo |
| GET | `/api/v1/dashboard/summary` | Sí | KPIs operativos, últimos días y ventas recientes |
| GET / POST | `/api/v1/users` | Admin | Listar usuarios de la empresa y crear cuentas con DNI, contraseña y rol |
| PUT / DELETE | `/api/v1/users/{id}` | Admin | Editar usuario o retirar acceso conservando ventas históricas |
| POST | `/api/v1/users/{id}/clear-password` | Admin | Quitar contraseña y desactivar la cuenta |

## Ejemplo de venta

Entrada: `customer_id` (opcional), `items` (`product_id`, `quantity`), descuento monetario, `payment_method` y nota opcional. El navegador no envía precios: la API los lee de la base. La respuesta de venta contiene cabecera, líneas, cliente, pagos y fecha.

Métodos de pago admitidos por interfaz demo: efectivo (`cash`), tarjeta (`card`), transferencia (`transfer`) y billetera (`wallet`). El método se conserva como código en la base.

## Seguridad de esta fase

El login principal valida DNI+Argon2 y emite un JWT HS256 con expiración. En rutas protegidas se aceptan tanto ese token interno como JWT Supabase verificados mediante JWKS, emisor y audiencia. Administración de usuarios es exclusiva de `admin`; escritura de venta/cliente de `seller`; escritura de catálogo e inventario de `warehouse`; `manager` y `analyst` mantienen acceso de consulta. Cambiar o eliminar credenciales desactiva el acceso si falta DNI o contraseña.
