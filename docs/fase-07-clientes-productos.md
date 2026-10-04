# Fase 07 — Clientes y productos

## Clientes

- Alta y consulta de clientes activos.
- Edición y desactivación lógica sin perder ventas históricas.
- Campos: nombre/razón social, correo, teléfono, documento y dirección.
- Búsqueda parcial por nombre, correo o teléfono.
- Consulta del historial de ventas relacionado al cliente.
- Cada cliente pertenece a la organización; la venta puede vincular cliente o ser de mostrador.
- La relación `sales.customer_id` deja preparada la base para historial por cliente.

## Productos y categorías

- Alta/listado de productos con SKU, nombre, descripción, categoría, precio y stock inicial.
- Edición de ficha y desactivación lógica; cambios de existencias únicamente desde inventario.
- Categorías semilla: Tecnología, Oficina y Accesorios.
- Alta, edición y eliminación de categorías; no se permite borrar categorías aún vinculadas a productos.
- Búsqueda por nombre y SKU; SKU repetido se rechaza dentro de la empresa.
- Precio estrictamente positivo; existencias y mínimo no negativos.
- El stock se modifica únicamente mediante entrada inicial, venta o ajuste trazable.
- La categoría se devuelve junto al producto para mostrarla en catálogo e inventario.

## Aceptación

1. Los formularios invalidan datos incompletos o fuera de rango en cliente y servidor.
2. Las listas responden con búsqueda y estados vacío/error/carga.
3. Las altas persisten y aparecen en la lista.
4. Productos con stock cero no pueden agregarse a una venta.
