# Fase 06 — Frontend React

## Implementación

Aplicación SPA React + TypeScript sobre Vite, rutas con React Router, cliente HTTP Axios, gráficos con Recharts e iconografía Lucide. El token y perfil demo quedan en `localStorage`; Axios añade el Bearer a cada solicitud.

## Páginas

| Ruta | Pantalla | Operación |
|---|---|---|
| `/login` | Inicio de sesión | Autenticación y acceso inicial de demo |
| `/` | Resumen ejecutivo | KPIs, últimos días, últimas ventas y alertas de stock |
| `/clientes` | Directorio | Búsqueda y alta de clientes |
| `/productos` | Catálogo | Búsqueda, categorías, precios, stock y alta de productos |
| `/categorias` | Clasificación | Alta, edición y eliminación protegida de categorías |
| `/ventas` | Historial | Filtro por número, cliente, pago e importe |
| `/ventas/nueva` | Punto de venta | Carrito, cliente, descuento, IGV, pago y confirmación |
| `/inventario` | Control de existencias | Niveles, ajuste con motivo e historial de movimientos |
| `/usuarios` | Administración (solo admin) | Crear, editar, desactivar y retirar credenciales; asignar DNI, contraseña y rol |

## Estados y componentes

Las pantallas cubren carga, error y contenido vacío. Formularios usan estados controlados y validación HTML, mientras que el backend repite todas las comprobaciones relevantes. La navegación y acciones de escritura reflejan los roles del plan; la API impone la autorización definitiva. El diseño se adapta a escritorio, tableta y móvil; la navegación lateral se transforma en navegación inferior en móvil.
