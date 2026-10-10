# Fase 10 — Dashboard Analytics

## Alcance implementado

`GET /api/v1/analytics/dashboard` entrega ingresos, variación frente al periodo anterior equivalente, número de ventas, ticket promedio, clientes activos, productos con stock bajo, ventas por día, cinco productos principales y distribución de pagos.

`GET /api/v1/dashboard/summary` también compara los ingresos del mes a la fecha con el mismo número de días inmediatamente anterior y devuelve `month_revenue_change_percent`. Cuando no existe ingreso en el periodo comparable, devuelve `null` para no presentar un porcentaje engañoso.

Acepta `start_date` y `end_date` con formato ISO `YYYY-MM-DD`; por defecto usa los últimos 30 días y limita la consulta a 366 días. Las consultas filtran por empresa y ventas completadas.

## Interfaz

La pestaña **Dashboard** de `/analitica` presenta KPIs y gráficos de evolución, productos e importes por método de pago. Los filtros de fecha actualizan las tres vistas de periodo.