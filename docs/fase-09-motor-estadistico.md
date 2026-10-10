# Fase 09 — Motor estadístico

## Alcance implementado

`POST /api/v1/analytics/statistics` recibe nombre, variable, entre 1 y 10 000 valores numéricos y un umbral opcional. Calcula conteo, media, mediana, moda, mínimo, máximo, rango, varianza y desviación estándar poblacionales, más la probabilidad empírica de observar un valor igual o superior al umbral. Se persisten dataset, variable, observaciones, análisis y resultado.

`POST /api/v1/analytics/statistics/linear` recibe dos variables numéricas pareadas. Calcula covarianza y correlación de Pearson, regresión lineal simple y operaciones vectoriales (suma, resta, producto punto y normas). Requiere al menos dos observaciones por variable y tamaños iguales. Si una variable es constante, comunica que la correlación no está definida en vez de devolver un valor engañoso.

`POST /api/v1/analytics/bayes` calcula $P(H|E)$ desde la probabilidad previa y las verosimilitudes $P(E|H)$ y $P(E|\neg H)$. Rechaza entradas fuera del intervalo [0, 1] y evidencia imposible bajo ambas hipótesis; guarda evidencia, parámetros y posterior.

## Uso

Los formularios están en `/analitica`, pestaña **Estadística y Bayes**. Historial accesible en los mismos endpoints con `GET`. Acceso: admin, manager y analyst. Los análisis se aíslan por empresa. Pearson describe asociación lineal y no demuestra causalidad.