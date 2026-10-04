# Fase 10 — Dashboard Analytics

## Alcance implementado

`GET /api/v1/analytics/dashboard` entrega ingresos, variación frente al periodo anterior equivalente, número de ventas, ticket promedio, clientes activos, productos con stock bajo, ventas por día, cinco productos principales y distribución de pagos.

Acepta `start_date` y `end_date` con formato ISO `YYYY-MM-DD`; por defecto usa los últimos 30 días y limita la consulta a 366 días. Las consultas filtran por empresa y ventas completadas.

## Interfaz

La pestaña **Dashboard** de `/analitica` presenta KPIs y gráficos de evolución, productos e importes por método de pago. Los filtros de fecha actualizan las tres vistas de periodo.