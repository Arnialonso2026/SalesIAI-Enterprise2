# Fase 08 — Ventas, pedidos e inventario

## Flujo completo

1. Seleccionar cliente (opcional) y artículos; acumular cantidades por producto.
2. Backend lee precio actual, valida organización, estado y stock disponible bajo bloqueo de fila.
3. Calcular detalle, subtotal y descuento monetario.
4. Aplicar tasa configurable a la base imponible.
5. Crear cabecera, líneas con descripción/precio capturados, pago inicial y movimientos de salida.
6. Restar cantidades del stock y guardar el saldo posterior y referencia de venta.
7. Confirmar la transacción; cualquier error revierte todos los cambios.
8. Consultar la venta en el historial, los abonos y el saldo pendiente en cuentas por cobrar.
9. Seleccionar boleta o factura al preparar la orden y generar como máximo un comprobante interno al confirmar la venta, con una copia histórica de los datos editados del cliente, importes y artículos. Las ediciones desde la orden no actualizan el catálogo de clientes.
10. Antes de registrar una venta, abrir una vista previa editable del comprobante seleccionado para revisar cliente, artículos, cantidades, descuento e importes. Solo la confirmación final registra la venta y genera el comprobante.
11. Al finalizar, abrir el módulo Comprobantes de pago, que lista boletas y facturas emitidas y permite consultar los datos capturados y el vínculo con la orden.
12. Centralizar el historial de órdenes en Cuentas por cobrar, con vistas para los saldos abiertos y todas las ventas registradas; distinguir «Pendiente de pago», «Pago parcial» y «Pagada» según los abonos aplicados, sin confundirlo con el estado operativo de la orden.

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
- El historial de Kardex se consulta por páginas ordenadas de más reciente a más antiguo, para recorrer más de 100 movimientos sin cargar todo el libro de una sola vez.
- Stock insuficiente o ajuste que daría stock negativo produce error sin confirmar cambios.
- Cada pago de la versión demo es por el total y guarda método, estado y fecha.
- Una venta acepta pago completo o abono inicial; los pagos posteriores se registran como nuevos abonos y no pueden superar el saldo pendiente.
- Las ventas con saldo positivo aparecen en cuentas por cobrar hasta que se complete el pago.
- El historial permite consultar comprobantes internos generados desde la orden; las facturas requieren empresa con RUC de 11 dígitos.
- El módulo Comprobantes de pago lista boletas y facturas de la empresa autenticada y conserva los datos del cliente y los artículos capturados al emitir cada documento.
- La venta no se registra hasta que el usuario confirma la vista previa del comprobante; los datos corregidos en esa vista previa se guardan como instantánea del documento.
- El estado de pago del historial se calcula comparando los abonos registrados con el total de la venta; la etiqueta operativa «completada» no se utiliza como sinónimo de «pagada».
- El comprobante conserva una copia de los datos e importes al emitirse; no es un comprobante tributario y no se integra con SUNAT.

## Criterios de aceptación

- Venta multítem con cantidades correctas y cálculos a dos decimales.
- Descuento fuera del rango y producto/cliente ajeno o inexistente rechazados.
- Stock insuficiente no genera venta, pago ni movimiento parcial.
- Venta correcta disminuye el stock exactamente una vez y queda en historial.
- El pago parcial conserva cada abono y el saldo calculado; el último abono liquida la cuenta y un sobrepago se rechaza.
- Ajuste con motivo aparece en movimientos y el saldo coincide con el producto.
- Reintentar el registro no reutiliza el mismo identificador de venta.
- El comprobante interno muestra una numeración por serie y no puede duplicarse para una venta.

## Límites conocidos de la primera entrega

El módulo de compras y proveedores queda fuera del alcance comercial actual. No hay pedido con reserva temporal, anulación/devolución, múltiples monedas, múltiples almacenes, pagos/cuentas por pagar de proveedores, emisión tributaria/SUNAT ni auditoría inmutable. Definir esos flujos antes de extender las entidades.
