# Fase 12 — Reportes

## Alcance implementado

`POST /api/v1/analytics/reports/export` genera y descarga un informe en CSV o JSON. Incluye ingresos, ventas, ticket promedio, clientes, alertas de stock, serie diaria, productos principales, métodos de pago, análisis descriptivos y resultados Bayes del periodo. La generación queda registrada en `reports`; `GET /api/v1/analytics/reports` consulta el historial de la empresa.

El cuerpo admite `format` (`csv` o `json`) y fechas opcionales `start_date` / `end_date` en formato ISO. El rango predeterminado y el máximo son iguales a los del dashboard. CSV se entrega en UTF-8 con BOM para compatibilidad con hojas de cálculo.

## Interfaz

La pestaña **Reportes** de `/analitica` permite seleccionar fechas y formato, descargar el archivo y revisar el historial de exportaciones.