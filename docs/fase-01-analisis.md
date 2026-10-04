# Fase 01 — Análisis y levantamiento

## Problema y objetivo

Un sistema que solamente registra ventas no convierte sus operaciones en información útil. SalesIA Enterprise centraliza clientes, productos, ventas, pagos e inventario, y deja datos consistentes para Analytics (fase 9 en adelante).

**Objetivo general:** desarrollar un sistema web empresarial para registrar operaciones comerciales y preparar los datos que posteriormente alimentarán el análisis estadístico.

## Alcance entregado (fases 1–8)

- Inicio de sesión con token y perfil de usuario.
- Catálogo de clientes, categorías y productos.
- Búsqueda de clientes, productos y ventas.
- Registro de venta por uno o más productos, con cliente opcional.
- Cálculo de subtotal, descuento, IGV y total.
- Registro de pago y descuento de inventario dentro de una operación consistente.
- Ajustes de inventario con motivo e historial de movimientos.
- Panel operativo con ingresos, conteos y ventas recientes.

Quedan fuera de este corte: motor estadístico, Bayes, insights automatizados, exportación, permisos granulares y publicación productiva.

## Actores

| Actor | Responsabilidad inicial |
|---|---|
| Administrador | Acceso autenticado, gestión operativa y parámetros del sistema |
| Vendedor | Consulta clientes/productos y registra ventas autorizadas |
| Almacén | Consulta existencias y registra ajustes con motivo |
| Gerente | Consulta resumen operativo e historial comercial |
| Analista | Consumirá los datos comerciales en fases analíticas posteriores |

En esta entrega todos los endpoints protegidos requieren usuario autenticado. La matriz de permisos por rol pertenece a la fase 13.

## Casos de uso y aceptación

| ID | Caso de uso | Criterio de aceptación |
|---|---|---|
| UC-01 | Iniciar sesión | Credenciales válidas devuelven token y usuario; credenciales inválidas no autentican. |
| UC-02 | Crear/consultar cliente | El cliente queda asociado a la empresa; la búsqueda filtra nombre, correo o teléfono. |
| UC-03 | Crear/consultar producto | SKU, nombre, precio y stock son válidos; SKU repetido se rechaza. |
| UC-04 | Consultar catálogo | Se muestra la categoría y el stock actual; los resultados admiten búsqueda. |
| UC-05 | Registrar venta | Se valida cliente, cantidad y existencia antes de confirmar la operación. |
| UC-06 | Calcular cobro | Descuento no negativo y no superior al subtotal; impuesto aplicado a la base descontada. |
| UC-07 | Registrar pago | El pago se asocia a la venta por el importe total y el método elegido. |
| UC-08 | Actualizar inventario | Cada venta descuenta existencias y registra cantidad, saldo, fecha y referencia. |
| UC-09 | Ajustar existencias | Se exige motivo y el stock nunca puede quedar negativo. |
| UC-10 | Consultar historial | El historial identifica venta, cliente, artículos, importe, fecha y método de pago. |

## Reglas de negocio

1. El precio y el stock disponibles se obtienen del servidor; no se aceptan precios enviados por el navegador.
2. El descuento se representa como importe monetario y no puede superar el subtotal.
3. IGV inicial configurable mediante `TAX_RATE`, con valor de demostración 0.18.
4. El impuesto se calcula sobre subtotal menos descuento; importes se redondean a dos decimales.
5. Una venta no permite producto inactivo, inexistente o con stock insuficiente.
6. Si un producto aparece repetido en el carrito, la validación acumula las cantidades.
7. Venta, detalles, pago y movimientos de salida se confirman en una sola transacción.
8. Todo ajuste manual conserva su motivo; un movimiento de salida no puede llevar el stock debajo de cero.
9. El stock inicial de un producto también produce un movimiento trazable.
10. Los registros operativos llevan el identificador de empresa para separar los datos de cada organización.
