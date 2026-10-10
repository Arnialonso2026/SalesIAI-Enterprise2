import { FormEvent, useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ClipboardList, PackageSearch, Plus, RotateCcw, Search, ShoppingBag, Warehouse } from 'lucide-react'
import { api, errorMessage } from '../api'
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../App'
import type { InventoryMovement, Product, Sale } from '../types'
import { currency, dateTime, formatCustomerDocument } from '../utils'
import { useRealtimeRefresh } from '../useRealtimeRefresh'
import './inventory.css'

const movementLabel: Record<string, string> = { sale: 'Venta', purchase: 'Compra', entry: 'Ingreso', adjustment: 'Ajuste', initial: 'Stock inicial' }
const MOVEMENT_PAGE_SIZE = 100

type InventorySection = 'sales' | 'products' | 'stock' | 'movements'
type StockTrackingStatus = 'out' | 'critical' | 'tracking' | 'healthy'

const stockStatusLabels: Record<StockTrackingStatus, string> = {
  out: 'Agotado',
  critical: 'Crítico',
  tracking: 'En seguimiento',
  healthy: 'Saludable',
}

function stockReference(product: Product) {
  return Math.max(product.min_stock * 2, product.min_stock + 1)
}

function getStockTrackingStatus(product: Product): StockTrackingStatus {
  if (product.stock <= 0) return 'out'
  if (product.stock <= product.min_stock) return 'critical'
  if (product.stock < stockReference(product)) return 'tracking'
  return 'healthy'
}

export default function InventoryPage() {
  const { user } = useAuth()
  const canAdjustInventory = user?.role === 'admin' || user?.role === 'warehouse'
  const [section, setSection] = useState<InventorySection>('sales')
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [salesSearch, setSalesSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [movementSearch, setMovementSearch] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState('all')
  const [movementProductFilter, setMovementProductFilter] = useState('all')
  const [hasMoreMovements, setHasMoreMovements] = useState(false)
  const [loadingMoreMovements, setLoadingMoreMovements] = useState(false)
  const [salesLoading, setSalesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [productResponse, movementResponse] = await Promise.all([
        api.get<Product[]>('/products'),
        api.get<InventoryMovement[]>('/inventory/movements', { params: { limit: MOVEMENT_PAGE_SIZE, offset: 0 } }),
      ])
      setProducts(productResponse.data)
      setMovements(movementResponse.data)
      setHasMoreMovements(movementResponse.data.length === MOVEMENT_PAGE_SIZE)
      setError('')
    } catch (cause) { setError(errorMessage(cause)) } finally { setLoading(false) }
  }
  async function loadMoreMovements() {
    if (loadingMoreMovements || !hasMoreMovements) return
    setLoadingMoreMovements(true)
    try {
      const { data } = await api.get<InventoryMovement[]>('/inventory/movements', {
        params: { limit: MOVEMENT_PAGE_SIZE, offset: movements.length },
      })
      setMovements((current) => [...current, ...data])
      setHasMoreMovements(data.length === MOVEMENT_PAGE_SIZE)
      setError('')
    } catch (cause) { setError(errorMessage(cause)) } finally { setLoadingMoreMovements(false) }
  }
  async function loadSales(search = salesSearch) {
    setSalesLoading(true)
    try {
      const { data } = await api.get<Sale[]>('/sales', { params: { search } })
      setSales(data); setError('')
    } catch (cause) { setError(errorMessage(cause)) } finally { setSalesLoading(false) }
  }
  useEffect(() => { void load() }, [])
  useRealtimeRefresh(() => { void load(); void loadSales() })

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setSaving(true); setError('')
    try {
      await api.post(`/inventory/products/${selected.id}/adjust`, { quantity: Number(quantity), note })
      setSelected(null); setQuantity(''); setNote(''); await load()
    } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  const lowStock = products.filter((product) => product.stock <= product.min_stock).length
  const categories = [...new Map(products.filter((product) => product.category).map((product) => [product.category!.id, product.category!])).values()]
    .sort((first, second) => first.name.localeCompare(second.name))
  const filteredProducts = products.filter((product) => {
    const search = productSearch.trim().toLocaleLowerCase()
    const matchesSearch = !search || product.name.toLocaleLowerCase().includes(search) || product.sku.toLocaleLowerCase().includes(search)
    const matchesCategory = categoryFilter === 'all' || String(product.category_id ?? '') === categoryFilter
    const matchesStock = stockFilter === 'all'
      || (stockFilter === 'out' && product.stock === 0)
      || getStockTrackingStatus(product) === stockFilter
    return matchesSearch && matchesCategory && matchesStock
  })
  const stockCounts: Record<StockTrackingStatus, number> = { out: 0, critical: 0, tracking: 0, healthy: 0 }
  products.forEach((product) => { stockCounts[getStockTrackingStatus(product)] += 1 })
  const productById = new Map(products.map((product) => [product.id, product]))
  const filteredMovements = movements.filter((movement) => {
    const product = productById.get(movement.product_id)
    const search = movementSearch.trim().toLocaleLowerCase()
    const searchable = [product?.name, product?.sku, movement.note, movementLabel[movement.movement_type] || movement.movement_type]
      .filter(Boolean).join(' ').toLocaleLowerCase()
    return (!search || searchable.includes(search))
      && (movementTypeFilter === 'all' || movement.movement_type === movementTypeFilter)
      && (movementProductFilter === 'all' || String(movement.product_id) === movementProductFilter)
  })
  return <>
    <PageHeader eyebrow="INVENTARIO Y OPERACIÓN COMERCIAL" title="Inventario" description="Consulta las ventas realizadas y conserva el control de existencias y movimientos." />
    {error && <ErrorMessage message={error} />}
    <div className="inventory-overview"><div className="inventory-overview-card"><span className="inventory-overview-icon"><PackageSearch size={19} /></span><div><small>Productos en catálogo</small><strong>{products.length}</strong></div></div><div className="inventory-overview-card"><span className="inventory-overview-icon inventory-warning"><RotateCcw size={18} /></span><div><small>Alertas de stock bajo</small><strong>{lowStock}</strong></div></div><div className="inventory-overview-card"><span className="inventory-overview-icon inventory-history"><ClipboardList size={18} /></span><div><small>Movimientos recientes</small><strong>{movements.length}</strong></div></div></div>
    <div className="inventory-sections" role="tablist" aria-label="Secciones de inventario">
      <button className={`inventory-section-tab ${section === 'sales' ? 'active' : ''}`} role="tab" aria-selected={section === 'sales'} onClick={() => { setSection('sales'); void loadSales() }}><ShoppingBag size={14} /> Historial de ventas</button>
      <button className={`inventory-section-tab ${section === 'products' ? 'active' : ''}`} role="tab" aria-selected={section === 'products'} onClick={() => setSection('products')}><PackageSearch size={14} /> Control de productos</button>
      <button className={`inventory-section-tab ${section === 'stock' ? 'active' : ''}`} role="tab" aria-selected={section === 'stock'} onClick={() => setSection('stock')}><Warehouse size={14} /> Existencias</button>
      <button className={`inventory-section-tab ${section === 'movements' ? 'active' : ''}`} role="tab" aria-selected={section === 'movements'} onClick={() => setSection('movements')}><ClipboardList size={14} /> Movimientos</button>
    </div>
    {section === 'sales' && <section className="panel table-panel"><div className="table-toolbar"><div className="table-heading"><div className="table-icon sales-icon"><ShoppingBag size={18} /></div><div><strong>Historial de ventas</strong><span>{sales.length} operaciones encontradas</span></div></div><label className="search-field"><Search size={16} /><input value={salesSearch} onChange={(event) => { setSalesSearch(event.target.value); void loadSales(event.target.value) }} placeholder="Buscar orden, cliente, RUC o vendedor…" /></label></div>
      {salesLoading ? <Loading /> : sales.length ? <div className="table-scroll"><table><thead><tr><th>N.º DE ORDEN</th><th>FECHA Y HORA</th><th>CLIENTE</th><th>GENERADA POR</th><th>ARTÍCULOS</th><th>PAGO</th><th>TOTAL</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><span className="sale-number">{sale.sale_number}</span></td><td>{dateTime(sale.created_at)}</td><td><div className="simple-cell"><strong>{sale.customer?.name || 'Venta mostrador'}</strong><small>{sale.customer?.document_number ? formatCustomerDocument(sale.customer.document_number) : sale.customer?.email || 'Cliente no identificado'}</small></div></td><td>{sale.created_by?.full_name || 'Usuario no disponible'}</td><td><span className="items-count">{sale.items.reduce((sum, item) => sum + item.quantity, 0)} artículos</span></td><td><span className="category-chip payment-chip">{sale.payments[0]?.method || '—'}</span></td><td><strong className="price-value">{currency(sale.total)}</strong></td></tr>)}</tbody></table></div> : <EmptyState title="No hay ventas para mostrar" description="Las ventas que registres aparecerán aquí junto con su orden, cliente e importe." />}
    </section>}
    {section === 'products' && <section className="panel inventory-control-panel"><div className="table-toolbar"><div className="table-heading"><div className="table-icon inventory-icon"><PackageSearch size={18} /></div><div><strong>Control de productos</strong><span>{filteredProducts.length} de {products.length} productos</span></div></div></div>
      <div className="inventory-control-toolbar"><div className="inventory-filter-field"><label htmlFor="inventory-product-filter">Producto</label><div className="search-field"><Search size={15} /><input id="inventory-product-filter" type="search" aria-label="Buscar producto por nombre o SKU" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar producto o SKU…" /></div></div><div className="inventory-filter-field"><label htmlFor="inventory-category-filter">Categoría</label><select id="inventory-category-filter" className="inventory-filter-select" aria-label="Filtrar por categoría" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div className="inventory-filter-field"><label htmlFor="inventory-stock-filter">Estado del stock</label><select id="inventory-stock-filter" className="inventory-filter-select" aria-label="Filtrar por estado del stock" value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="all">Todos los estados</option><option value="out">Agotado</option><option value="critical">Crítico</option><option value="tracking">En seguimiento</option><option value="healthy">Saludable</option></select></div></div>
      {loading ? <Loading /> : filteredProducts.length ? <div className="inventory-control-layout"><div className="inventory-stock-card-grid">{filteredProducts.map((product) => {
        const stockStatus = getStockTrackingStatus(product)
        const reference = stockReference(product)
        const fillPercent = Math.min(100, Math.max(0, (product.stock / reference) * 100))
        const minimumPercent = Math.min(100, (product.min_stock / reference) * 100)
        const followUpText: Record<StockTrackingStatus, string> = {
          out: 'Sin unidades disponibles',
          critical: 'Por debajo del mínimo de reposición',
          tracking: 'Vigilar próximas salidas',
          healthy: 'Existencias dentro del nivel esperado',
        }
        return <article className={`inventory-stock-card tracking-${stockStatus}`} key={product.id} aria-label={`${product.name}: ${stockStatusLabels[stockStatus]}`}>
          <div className="inventory-stock-card-heading"><div><strong>{product.name}</strong><small>{product.sku} · {product.category?.name || 'Sin categoría'}</small></div><span className={`inventory-tracking-badge tracking-${stockStatus}`}><i />{stockStatusLabels[stockStatus]}</span></div>
          <div className="inventory-stock-values"><div><small>Stock actual</small><strong>{product.stock} <span>u.</span></strong></div><div><small>Mínimo</small><strong>{product.min_stock} <span>u.</span></strong></div></div>
          <div className="inventory-stock-track" role="meter" aria-label={`Nivel de stock de ${product.name}`} aria-valuemin={0} aria-valuemax={reference} aria-valuenow={Math.min(product.stock, reference)}><span className={`inventory-stock-fill tracking-${stockStatus}`} style={{ width: `${fillPercent}%` }} /><i className="inventory-stock-minimum" style={{ left: `${minimumPercent}%` }} /></div>
          <div className="inventory-stock-card-footer"><span>{followUpText[stockStatus]}</span>{canAdjustInventory && <button className="button button-small button-secondary" type="button" aria-label={`Ajustar stock de ${product.name}`} onClick={() => { setSelected(product); setQuantity(''); setNote('') }}><Plus size={13} /> Ajustar</button>}</div>
        </article>
      })}</div><aside className="inventory-tracking-side"><section className="inventory-tracking-summary"><div className="inventory-tracking-heading"><span className="eyebrow">ESTADO DEL CATÁLOGO</span><h3>Seguimiento</h3></div><div className="inventory-status-grid">{(['out', 'critical', 'tracking', 'healthy'] as StockTrackingStatus[]).map((status) => <div className={`inventory-status-count tracking-${status}`} key={status}><i /><span>{stockStatusLabels[status]}</span><strong>{stockCounts[status]}</strong></div>)}</div></section><section className="inventory-tracking-activity"><div className="inventory-tracking-heading"><span className="eyebrow">TRAZABILIDAD</span><h3>Actividad reciente</h3><p>{movements.length} movimientos cargados</p></div>{movements.slice(0, 8).length ? movements.slice(0, 8).map((movement) => {
        const product = products.find((item) => item.id === movement.product_id)
        const outgoing = movement.quantity < 0
        return <div className="inventory-mini-movement" key={movement.id}><span className={`movement-symbol ${outgoing ? 'movement-out' : 'movement-in'}`}>{outgoing ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}</span><div><strong>{product?.name || `Producto #${movement.product_id}`}</strong><small>{movementLabel[movement.movement_type] || movement.movement_type} · {dateTime(movement.created_at)}</small></div><b className={outgoing ? 'negative-quantity' : 'positive-quantity'}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</b></div>
      }) : <div className="movement-empty">Sin movimientos recientes.</div>}{movements.length > 0 && <button className="inventory-activity-link" type="button" onClick={() => setSection('movements')}>Ver todos los movimientos <span>{movements.length}</span></button>}</section></aside></div> : <EmptyState title="No hay productos con esos filtros" description="Cambia los filtros o revisa el catálogo de productos." />}
    </section>}
    {section === 'stock' && <section className="panel table-panel"><div className="table-toolbar"><div className="table-heading"><div className="table-icon inventory-icon"><PackageSearch size={18} /></div><div><strong>Existencias actuales</strong><span>{canAdjustInventory ? 'Ajusta stock para registrar ingresos o correcciones' : 'Consulta niveles y movimientos de existencias'}</span></div></div><span className="period-chip"><span /> Inventario actualizado</span></div>
      {loading ? <Loading /> : products.length ? <div className="table-scroll"><table><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>STOCK ACTUAL</th><th>STOCK MÍNIMO</th><th>NIVEL</th>{canAdjustInventory && <th>ACCIÓN</th>}</tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="product-cell"><span className="product-avatar"><PackageSearch size={17} /></span><div><strong>{product.name}</strong><small>{product.sku}</small></div></div></td><td><span className="category-chip">{product.category?.name || 'Sin categoría'}</span></td><td><strong className={product.stock <= product.min_stock ? 'stock-value-low' : 'stock-value'}>{product.stock} u.</strong></td><td>{product.min_stock} u.</td><td><span className={`status-pill ${product.stock <= product.min_stock ? 'status-low' : 'status-active'}`}><i />{product.stock <= product.min_stock ? 'Reponer' : 'Saludable'}</span></td>{canAdjustInventory && <td><button className="button button-small button-secondary" onClick={() => { setSelected(product); setQuantity(''); setNote('') }}><Plus size={14} /> Ajustar</button></td>}</tr>)}</tbody></table></div> : <EmptyState title="No hay productos" description="Agrega productos para comenzar a gestionar las existencias." />}
    </section>}
    {section === 'movements' && <section className="panel movement-panel"><div className="panel-heading movement-heading"><div><span className="eyebrow">TRAZABILIDAD</span><h2>Historial de movimientos</h2><p>Entradas, salidas por venta y ajustes manuales</p></div><span className="movement-count">{filteredMovements.length} de {movements.length} movimientos</span></div><div className="movement-filters"><label className="search-field"><Search size={15} /><input type="search" aria-label="Buscar movimientos" placeholder="Buscar producto, SKU o motivo…" value={movementSearch} onChange={(event) => setMovementSearch(event.target.value)} /></label><select className="inventory-filter-select" aria-label="Filtrar tipo de movimiento" value={movementTypeFilter} onChange={(event) => setMovementTypeFilter(event.target.value)}><option value="all">Todos los tipos</option>{Object.entries(movementLabel).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select><select className="inventory-filter-select" aria-label="Filtrar producto en movimientos" value={movementProductFilter} onChange={(event) => setMovementProductFilter(event.target.value)}><option value="all">Todos los productos</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div>{loading ? <Loading /> : filteredMovements.length ? <div className="movement-list">{filteredMovements.map((movement) => {
      const product = products.find((item) => item.id === movement.product_id)
      const isOutgoing = movement.quantity < 0
      return <div className="movement-row" key={movement.id}><span className={`movement-symbol ${isOutgoing ? 'movement-out' : 'movement-in'}`}>{isOutgoing ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}</span><div className="movement-description"><strong>{product?.name || `Producto #${movement.product_id}`}</strong><small>{movement.note || movementLabel[movement.movement_type] || movement.movement_type} · {dateTime(movement.created_at)}</small></div><div className="movement-change"><strong className={isOutgoing ? 'negative-quantity' : 'positive-quantity'}>{movement.quantity > 0 ? '+' : ''}{movement.quantity} u.</strong><small>Saldo: {movement.stock_after}</small></div></div>
    })}</div> : <div className="movement-empty">{movements.length ? 'No hay movimientos que coincidan con esos filtros.' : 'Todavía no se registraron movimientos.'}</div>}{hasMoreMovements && <div className="movement-pagination"><span>Se muestran los movimientos cargados hasta ahora.</span><button className="button button-secondary button-small" type="button" disabled={loadingMoreMovements} onClick={() => void loadMoreMovements()}>{loadingMoreMovements ? 'Cargando…' : 'Cargar movimientos anteriores'}</button></div>}</section>}
    {selected && <Modal title="Ajustar existencias" description={`Actualiza el stock de ${selected.name}. Los cambios se registran en la trazabilidad.`} onClose={() => setSelected(null)} onSubmit={adjust} submitLabel={saving ? 'Registrando…' : 'Registrar movimiento'}><div className="adjust-current-stock"><span>Stock actual</span><strong>{selected.stock} unidades</strong></div><div className="form-grid"><label className="form-field span-2">Variación de stock<input autoFocus type="number" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required placeholder="Ej. 10 para ingreso, -2 para corrección" /><small>Usa un número positivo para ingresar o negativo para descontar existencias.</small></label><label className="form-field span-2">Motivo del movimiento<input value={note} onChange={(event) => setNote(event.target.value)} minLength={2} required placeholder="Ej. Reposición de proveedor" /></label></div></Modal>}
  </>
}
