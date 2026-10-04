# Fase 11 — Insights empresariales

## Alcance implementado

`POST /api/v1/analytics/insights/generate` evalúa reglas explícitas sobre el rango solicitado: periodo sin ventas, cambio de ingresos de al menos 15% respecto del periodo anterior, productos bajo el mínimo y producto con mayor ingreso. Cada resultado explica el hallazgo y guarda los indicadores usados como evidencia.

`GET /api/v1/analytics/insights` lista hallazgos de la empresa. `PATCH /api/v1/analytics/insights/{id}` permite cambiar el estado a `new`, `read` o `dismissed`. No se generan recomendaciones mediante modelos opacos.

## Interfaz

La pestaña **Insights** de `/analitica` permite generar hallazgos, desplegar evidencia, marcarla revisada y descartarla.