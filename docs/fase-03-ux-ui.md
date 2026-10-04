# Fase 03 — UX/UI empresarial

## Dirección visual

- Azul corporativo para navegación primaria y acciones; cyan como acento; fondos blancos y grises azulados.
- Tipografías Manrope para títulos y DM Sans para lectura e interfaz.
- Jerarquía: etiqueta contextual, título, explicación breve, acción principal y contenido.
- Superficies con bordes sutiles, radios moderados, sombras discretas y espacio de lectura.
- Interfaz responsive: sidebar lateral en escritorio y navegación inferior en móvil.

## Navegación

1. Resumen ejecutivo — KPIs comerciales y actividad reciente.
2. Ventas — historial y creación de una nueva operación.
3. Clientes — directorio, búsqueda y alta de contactos.
4. Productos — catálogo, categorías, precio y nivel de stock.
5. Inventario — existencias, ajustes y trazabilidad.

## Flujos priorizados

- **Venta:** nueva venta → agregar producto/cantidad → asignar cliente opcional → método de pago → confirmar → backend recalcula y registra → historial/inventario.
- **Cliente:** abrir directorio → buscar o crear → ficha y datos de contacto.
- **Producto:** crear desde catálogo → asignar categoría y stock inicial → usarlo en el carrito.
- **Reposición:** inventario → ajustar → cantidad con signo y motivo → guardar movimiento.

## Componentes y estados

`AppLayout`, `PageHeader`, `Modal`, botones primario/secundario, tarjetas de métricas, tablas, chips de estado, búsqueda, lista de actividad y resumen de cobro. Las páginas contemplan carga, error y estado vacío. Los formularios usan validaciones nativas y vuelven a validar en el servidor.

## Wireframe de página principal

```text
┌ Sidebar: marca / espacio / navegación ─┐ ┌ Topbar: ruta / estado / usuario ───────┐
│ Resumen                                │ │ Título + descripción + acción           │
│ Ventas                                 │ │ Banner de contexto                      │
│ Clientes                               │ │ 4 KPIs                                  │
│ Productos                              │ │ Gráfico de ventas | actividad reciente │
│ Inventario                             │ │ Nota contextual                         │
└────────────────────────────────────────┘ └────────────────────────────────────────┘
```

## Accesibilidad y responsive

Controles con etiquetas, navegación con enlaces/botones semánticos, estado textual además del color, foco visible, contraste suficiente y respeto a `prefers-reduced-motion`. Tablas admiten desplazamiento horizontal en pantallas angostas y la barra de navegación se adapta a móvil.
