# Sucursales y mapa

El módulo `/sucursales` permite al administrador registrar, editar, desactivar y reactivar sucursales de su compañía. Cada sede contiene nombre, dirección opcional y coordenadas decimales de latitud y longitud. No asigna ventas a sucursales ni separa inventarios.

Las coordenadas se limitan al rango geográfico aproximado de Perú: latitud entre `-18.5` y `0.2`; longitud entre `-81.5` y `-68.5`. Las sucursales activas aparecen como puntos sobre el mapa de referencia. Las inactivas se conservan en el directorio, pero no se muestran en el mapa.

El backend valida el alcance por compañía y limita las modificaciones al rol administrador. La tabla `branches` se crea mediante la migración Alembic `20261013_0011` y también está incluida en `database/01_core.sql`.
