# Plan maestro de desarrollo — SalesIA Enterprise

## Propósito

Construir una plataforma empresarial donde las operaciones comerciales generan datos reutilizables por el módulo de analítica. La analítica estadística se desarrollará en la fase 9; este avance llega hasta el cierre funcional de la fase 8.

| Fase | Nombre | Entregable principal | Estado |
|---|---|---|---|
| 01 | Análisis y levantamiento | Alcance, requisitos, actores, reglas y casos de uso | Completada |
| 02 | Arquitectura técnica | Arquitectura, módulos, contratos y decisiones técnicas | Completada |
| 03 | UX/UI empresarial | Diseño visual, navegación, componentes y estados | Completada |
| 04 | Base de datos PostgreSQL | Modelo relacional, restricciones, migración y datos semilla | Completada |
| 05 | Backend/API | FastAPI, acceso autenticado, servicios y documentación OpenAPI | Completada |
| 06 | Frontend React | Interfaz responsive y consumo de API | Completada |
| 07 | Clientes y productos | CRUD, filtros, catálogo, fichas y categorías | Completada |
| 08 | Ventas, pedidos e inventario | Venta transaccional, detalle, pago, stock e historial | Completada |
| 09 | Motor estadístico — Semana 07 | Variables, media, mediana, probabilidad y Bayes | Completada |
| 10 | Dashboard Analytics | KPIs, gráficos, filtros y evolución | Completada |
| 11 | Insights empresariales | Reglas explicables y evidencia numérica | Completada |
| 12 | Reportes | Reportes comerciales/estadísticos y exportación | Completada |
| 13 | Seguridad y auditoría | Roles granulares, permisos y auditoría avanzada | Parcial: roles y permisos implementados; auditoría con filtros, paginación, actor histórico y trazabilidad de operaciones comerciales implementada; validar y completar evidencia |
| 14 | Pruebas y calidad | Pruebas de integración, API, UI y aceptación | Completada |
| 15 | Despliegue | Ambientes, HTTPS, monitoreo y publicación | En curso: configuración preparada; publicación y verificación pendientes |
| 16 | Cierre y documentación | Manuales, evidencias y mantenimiento | Pendiente |

## Criterio de corte

El producto implementado en las fases 1–12 permite mantener la operación comercial y consultar sus indicadores, cálculos estadísticos, insights explicables e informes exportables. El motor estadístico trabaja sobre series numéricas suministradas; no incluye todavía inferencia automática desde archivos arbitrarios ni modelos predictivos.

## Estado de entrega

La estructura fuente, contratos y entregables se describen en los documentos de cada fase dentro de `docs/`. La ejecución local requiere Docker Compose o una instancia PostgreSQL compatible. Las credenciales de demostración se indican en el README y deben cambiarse antes de cualquier despliegue real.

El módulo de sucursales mantiene un catálogo independiente con mapa geográfico; las ventas y existencias no se asignan a sedes ni se separan por sucursal.
