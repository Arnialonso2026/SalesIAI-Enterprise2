# Fase 14 — Pruebas y calidad

## Objetivo

Verificar los flujos críticos de autenticación, autorización, ventas, inventario, analítica y navegación de usuario mediante pruebas automatizadas de backend y frontend.

## Cobertura

| Nivel | Casos cubiertos |
|---|---|
| Unitario | Cálculo de importes y estadísticas, redondeo monetario y reglas de ventas |
| Contrato API | Estado de salud, endpoints protegidos, login inválido y malformado, usuario autenticado y datos sensibles excluidos |
| Integración API | Venta con pago y descuento, actualización de stock, movimientos, historial, rechazo por stock insuficiente y permisos por rol |
| Integración de módulos | Gestión de usuarios y auditoría, analítica, insights, exportación CSV, migraciones, autenticación Supabase y eventos en tiempo real |
| UI | Login correcto e incorrecto, redirección sin sesión, protección de administración por rol y carga del dashboard con estado vacío |
| Aceptación | Flujo autenticado de venta e inventario verificado mediante API; KPIs, acceso a nueva venta y controles de sesión verificados en UI |

## Puertas de calidad

Ejecutar desde la raíz del repositorio:

```bash
cd backend && . .venv/bin/activate && pytest -q
cd ../frontend && npm test -- --run
npm run build
```

Resultado de cierre: backend `16 passed`; frontend `5 passed`; build de producción correcto.

## Criterio de aceptación

La fase queda aceptada cuando las tres puertas anteriores terminan con código cero y las pruebas de integración aseguran que una venta válida actualiza el inventario mientras una venta sin stock suficiente se rechaza sin persistirse. Las pruebas de UI deben confirmar autenticación, denegación de rutas por rol y renderizado de los datos principales del dashboard.

La suite de backend emite un warning de deprecación de `starlette.testclient` relacionado con la integración instalada de HTTPX. No afecta el resultado actual; conviene resolverlo al actualizar las dependencias de pruebas.