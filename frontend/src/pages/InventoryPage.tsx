import { FormEvent, useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ClipboardList, PackageSearch, Plus, RotateCcw } from 'lucide-react'
import { api, errorMessage } from '../api'
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../App'
import type { InventoryMovement, Product } from '../types'
import { dateTime } from '../utils'

const movementLabel: Record<string, string> = { sale: 'Venta', entry: 'Ingreso', adjustment: 'Ajuste', initial: 'Stock inicial' }

export default function InventoryPage() {
  const { user } = useAuth()
  const canAdjustInventory = user?.role === 'admin' || user?.role === 'warehouse'
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [productResponse, movementResponse] = await Promise.all([api.get<Product[]>('/products'), api.get<InventoryMovement[]>('/inventory/movements')])
      setProducts(productResponse.data); setMovements(movementResponse.data); setError('')
    } catch (cause) { setError(errorMessage(cause)) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

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

  return <>
    <PageHeader eyebrow="CONTROL DE EXISTENCIAS" title="Inventario" description="Revisa tus existencias, identifica alertas y conserva la trazabilidad de cada movimiento." />
    {error && <ErrorMessage message={error} />}
    <div className="inventory-overview"><div className="inventory-overview-card"><span className="inventory-overview-icon"><PackageSearch size={19} /></span><div><small>Productos en catálogo</small><strong>{products.length}</strong></div></div><div className="inventory-overview-card"><span className="inventory-overview-icon inventory-warning"><RotateCcw size={18} /></span><div><small>Alertas de stock bajo</small><strong>{lowStock}</strong></div></div><div className="inventory-overview-card"><span className="inventory-overview-icon inventory-history"><ClipboardList size={18} /></span><div><small>Movimientos recientes</small><strong>{movements.length}</strong></div></div></div>
    <section className="panel table-panel"><div className="table-toolbar"><div className="table-heading"><div className="table-icon inventory-icon"><PackageSearch size={18} /></div><div><strong>Existencias actuales</strong><span>{canAdjustInventory ? 'Ajusta stock para registrar ingresos o correcciones' : 'Consulta niveles y movimientos de existencias'}</span></div></div><span className="period-chip"><span /> Inventario actualizado</span></div>
      {loading ? <Loading /> : products.length ? <div className="table-scroll"><table><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>STOCK ACTUAL</th><th>STOCK MÍNIMO</th><th>NIVEL</th>{canAdjustInventory && <th>ACCIÓN</th>}</tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="product-cell"><span className="product-avatar"><PackageSearch size={17} /></span><div><strong>{product.name}</strong><small>{product.sku}</small></div></div></td><td><span className="category-chip">{product.category?.name || 'Sin categoría'}</span></td><td><strong className={product.stock <= product.min_stock ? 'stock-value-low' : 'stock-value'}>{product.stock} u.</strong></td><td>{product.min_stock} u.</td><td><span className={`status-pill ${product.stock <= product.min_stock ? 'status-low' : 'status-active'}`}><i />{product.stock <= product.min_stock ? 'Reponer' : 'Saludable'}</span></td>{canAdjustInventory && <td><button className="button button-small button-secondary" onClick={() => { setSelected(product); setQuantity(''); setNote('') }}><Plus size={14} /> Ajustar</button></td>}</tr>)}</tbody></table></div> : <EmptyState title="No hay productos" description="Agrega productos para comenzar a gestionar las existencias." />}
    </section>
    <section className="panel movement-panel"><div className="panel-heading movement-heading"><div><span className="eyebrow">TRAZABILIDAD</span><h2>Últimos movimientos</h2><p>Registro de entradas, salidas por venta y ajustes manuales</p></div><span className="movement-count">{movements.length} movimientos</span></div>{loading ? <Loading /> : movements.length ? <div className="movement-list">{movements.slice(0, 8).map((movement) => {
      const product = products.find((item) => item.id === movement.product_id)
      const isOutgoing = movement.quantity < 0
      return <div className="movement-row" key={movement.id}><span className={`movement-symbol ${isOutgoing ? 'movement-out' : 'movement-in'}`}>{isOutgoing ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}</span><div className="movement-description"><strong>{product?.name || `Producto #${movement.product_id}`}</strong><small>{movement.note || movementLabel[movement.movement_type] || movement.movement_type} · {dateTime(movement.created_at)}</small></div><div className="movement-change"><strong className={isOutgoing ? 'negative-quantity' : 'positive-quantity'}>{movement.quantity > 0 ? '+' : ''}{movement.quantity} u.</strong><small>Saldo: {movement.stock_after}</small></div></div>
    })}</div> : <div className="movement-empty">Todavía no se registraron movimientos.</div>}</section>
    {selected && <Modal title="Ajustar existencias" description={`Actualiza el stock de ${selected.name}. Los cambios se registran en la trazabilidad.`} onClose={() => setSelected(null)} onSubmit={adjust} submitLabel={saving ? 'Registrando…' : 'Registrar movimiento'}><div className="adjust-current-stock"><span>Stock actual</span><strong>{selected.stock} unidades</strong></div><div className="form-grid"><label className="form-field span-2">Variación de stock<input autoFocus type="number" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required placeholder="Ej. 10 para ingreso, -2 para corrección" /><small>Usa un número positivo para ingresar o negativo para descontar existencias.</small></label><label className="form-field span-2">Motivo del movimiento<input value={note} onChange={(event) => setNote(event.target.value)} minLength={2} required placeholder="Ej. Reposición de proveedor" /></label></div></Modal>}
  </>
}
