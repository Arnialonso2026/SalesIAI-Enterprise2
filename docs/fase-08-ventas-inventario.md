# Fase 08 — Ventas, pedidos e inventario

## Flujo completo

1. Seleccionar cliente (opcional) y artículos; acumular cantidades por producto.
2. Backend lee precio actual, valida organización, estado y stock disponible bajo bloqueo de fila.
3. Calcular detalle, subtotal y descuento monetario.
4. Aplicar tasa configurable a la base imponible.
5. Crear cabecera, líneas con descripción/precio capturados, pago y movimientos de salida.
6. Restar cantidades del stock y guardar el saldo posterior y referencia de venta.
7. Confirmar la transacción; cualquier error revierte todos los cambios.
8. Consultar la venta en el historial y la salida en inventario.

## Regla de cálculo

Sean $S$ el subtotal, $D$ el descuento y $r$ la tasa tributaria configurada:

$$
B = S - D, \qquad IGV = \operatorname{redondear}(B \cdot r, 2), \qquad Total = B + IGV
$$

Las cantidades y moneda se vuelven a validar en servidor; se rechaza $D > S$. La tasa local de demostración es $r=0.18$ y está en `TAX_RATE`.

## Trazabilidad

- Detalle conserva el nombre y precio aplicado al momento de venta, evitando que ediciones futuras alteren ventas históricas.
- Cada artículo vendido produce un movimiento `sale` con cantidad negativa, saldo restante, fecha y `sale_id`.
- Ajustes manuales exigen nota; ingreso lleva cantidad positiva y reducción cantidad negativa.
- Stock insuficiente o ajuste que daría stock negativo produce error sin confirmar cambios.
- Cada pago de la versión demo es por el total y guarda método, estado y fecha.

## Criterios de aceptación

- Venta multítem con cantidades correctas y cálculos a dos decimales.
- Descuento fuera del rango y producto/cliente ajeno o inexistente rechazados.
- Stock insuficiente no genera venta, pago ni movimiento parcial.
- Venta correcta disminuye el stock exactamente una vez y queda en historial.
- Ajuste con motivo aparece en movimientos y el saldo coincide con el producto.
- Reintentar el registro no reutiliza el mismo identificador de venta.

## Límites conocidos de la primera entrega

No hay pedido con reserva temporal, pagos parciales, anulación/devolución, múltiples monedas, múltiples almacenes ni auditoría inmutable. Definir esos flujos antes de extender las entidades.
