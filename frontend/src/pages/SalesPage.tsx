import { useEffect, useState } from 'react'
import { ArrowUpRight, CircleDollarSign, Plus, Search, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../App'
import type { Sale } from '../types'
import { currency, dateTime } from '../utils'
import { useRealtimeRefresh } from '../useRealtimeRefresh'

export default function SalesPage() {
  const { user } = useAuth()
  const canCreateSale = user?.role === 'admin' || user?.role === 'seller'
  const [sales, setSales] = useState<Sale[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function load(term = search) {
    setLoading(true)
    try { const { data } = await api.get<Sale[]>('/sales', { params: { search: term } }); setSales(data); setError('') }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load('') }, [])
  useRealtimeRefresh(() => load())
  const total = sales.reduce((sum, sale) => sum + sale.total, 0)

  return <>
    <PageHeader eyebrow="OPERACIÓN COMERCIAL" title="Ventas" description="Consulta el historial de ventas y da seguimiento a cada operación registrada." action={canCreateSale && <Link className="button button-primary" to="/ventas/nueva"><Plus size={17} /> Nueva venta</Link>} />
    {error && <ErrorMessage message={error} />}
    <div className="sales-summary-row"><div className="sales-summary-card"><span className="summary-icon"><ShoppingBag size={18} /></span><div><small>Operaciones en pantalla</small><strong>{sales.length}</strong></div></div><div className="sales-summary-card"><span className="summary-icon summary-icon-green"><CircleDollarSign size={18} /></span><div><small>Importe del historial</small><strong>{currency(total)}</strong></div></div><div className="sales-summary-note"><ArrowUpRight size={16} /><span>Las ventas descuentan stock y dejan un registro de inventario.</span></div></div>
    <section className="panel table-panel"><div className="table-toolbar"><div className="table-heading"><div className="table-icon sales-icon"><ShoppingBag size={18} /></div><div><strong>Historial de ventas</strong><span>Ventas, pagos y detalle de cada operación</span></div></div><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); void load(event.target.value) }} placeholder="Buscar N.º de venta…" /></label></div>
      {loading ? <Loading /> : sales.length ? <div className="table-scroll"><table><thead><tr><th>N.º DE VENTA</th><th>CLIENTE</th><th>FECHA Y HORA</th><th>ARTÍCULOS</th><th>PAGO</th><th>TOTAL</th><th>ESTADO</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><span className="sale-number">{sale.sale_number}</span></td><td><div className="simple-cell"><strong>{sale.customer?.name || 'Venta mostrador'}</strong><small>{sale.customer?.email || 'Cliente no identificado'}</small></div></td><td>{dateTime(sale.created_at)}</td><td><span className="items-count">{sale.items.reduce((sum, item) => sum + item.quantity, 0)} artículos</span></td><td><span className="category-chip payment-chip">{sale.payments[0]?.method || '—'}</span></td><td><strong className="price-value">{currency(sale.total)}</strong></td><td><span className="status-pill status-completed">Completada</span></td></tr>)}</tbody></table></div> : <EmptyState title="Todavía no hay ventas" description="Registra una venta para iniciar tu historial comercial." />}
    </section>
    <div className="table-footnote">Los importes incluyen IGV al 18 %. El historial conserva el detalle y método de pago.</div>
  </>
}
