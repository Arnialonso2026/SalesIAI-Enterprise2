import { useEffect, useState } from 'react'
import { ArrowUpRight, CircleDollarSign, Eye, Plus, Search, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../App'
import type { Sale } from '../types'
import { currency, dateTime, formatCustomerDocument } from '../utils'
import { useRealtimeRefresh } from '../useRealtimeRefresh'

export default function SalesPage() {
  const { user } = useAuth()
  const canCreateSale = user?.role === 'admin' || user?.role === 'seller'
  const [sales, setSales] = useState<Sale[]>([])
  const [saleDetail, setSaleDetail] = useState<Sale | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
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
  const statusLabels: Record<string, string> = { completed: 'Completada', pending: 'Pendiente', cancelled: 'Anulada' }

  async function showSaleDetail(saleId: number) {
    setDetailLoading(true)
    setError('')
    try {
      const { data } = await api.get<Sale>(`/sales/${saleId}`)
      setSaleDetail(data)
    } catch (cause) { setError(errorMessage(cause)) } finally { setDetailLoading(false) }
  }

  return <>
    <PageHeader eyebrow="OPERACIÓN COMERCIAL" title="Ventas" description="Consulta el historial de ventas y da seguimiento a cada operación registrada." action={canCreateSale && <Link className="button button-primary" to="/ventas/nueva"><Plus size={17} /> Nueva venta</Link>} />
    {error && <ErrorMessage message={error} />}
    <div className="sales-summary-row"><div className="sales-summary-card"><span className="summary-icon"><ShoppingBag size={18} /></span><div><small>Operaciones en pantalla</small><strong>{sales.length}</strong></div></div><div className="sales-summary-card"><span className="summary-icon summary-icon-green"><CircleDollarSign size={18} /></span><div><small>Importe del historial</small><strong>{currency(total)}</strong></div></div><div className="sales-summary-note"><ArrowUpRight size={16} /><span>Las ventas descuentan stock y dejan un registro de inventario.</span></div></div>
    <section className="panel table-panel"><div className="table-toolbar"><div className="table-heading"><div className="table-icon sales-icon"><ShoppingBag size={18} /></div><div><strong>Historial de ventas</strong><span>Ventas, pagos y detalle de cada operación</span></div></div><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); void load(event.target.value) }} placeholder="Orden, cliente, RUC, contacto o vendedor…" /></label></div>
      {loading ? <Loading /> : sales.length ? <div className="table-scroll"><table><thead><tr><th>N.º DE ORDEN</th><th>CLIENTE</th><th>GENERADA POR</th><th>FECHA Y HORA</th><th>ARTÍCULOS</th><th>PAGO</th><th>TOTAL</th><th>ESTADO</th><th>DETALLE</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><span className="sale-number">{sale.sale_number}</span></td><td><div className="simple-cell"><strong>{sale.customer?.name || 'Venta mostrador'}</strong><small>{sale.customer?.document_number ? formatCustomerDocument(sale.customer.document_number) : sale.customer?.email || 'Cliente no identificado'}</small>{sale.customer?.email && sale.customer.document_number && <small>{sale.customer.email}</small>}{sale.customer?.phone && <small>{sale.customer.phone}</small>}{sale.customer?.address && <small>{sale.customer.address}</small>}</div></td><td>{sale.created_by?.full_name || 'Usuario no disponible'}</td><td>{dateTime(sale.created_at)}</td><td><span className="items-count">{sale.items.reduce((sum, item) => sum + item.quantity, 0)} artículos</span></td><td><span className="category-chip payment-chip">{sale.payments[0]?.method || '—'}</span></td><td><strong className="price-value">{currency(sale.total)}</strong></td><td><span className={`status-pill ${sale.status === 'completed' ? 'status-completed' : 'status-low'}`}>{statusLabels[sale.status] ?? sale.status}</span></td><td><button className="icon-button" type="button" aria-label={`Ver detalle de ${sale.sale_number}`} onClick={() => void showSaleDetail(sale.id)}><Eye size={15} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="Todavía no hay ventas" description="Registra una venta para iniciar tu historial comercial." />}
    </section>
    <div className="table-footnote">Los importes incluyen IGV al 18 %. El historial conserva el detalle y método de pago.</div>
    {detailLoading && <Loading label="Consultando detalle de venta…" />}
    {saleDetail && <Modal title={`Orden ${saleDetail.sale_number}`} description={`${dateTime(saleDetail.created_at)} · ${saleDetail.customer?.name || 'Venta mostrador'}`} onClose={() => setSaleDetail(null)} onSubmit={(event) => event.preventDefault()} hideActions>
      <div className="customer-history">
        <div className="customer-history-row"><div><strong>Estado</strong><small>{statusLabels[saleDetail.status] ?? saleDetail.status}</small></div><strong>{currency(saleDetail.total)}</strong></div>
        <div className="customer-history-row"><div><strong>Encargado</strong><small>{saleDetail.created_by?.full_name || 'Usuario no disponible'}</small></div><span>{saleDetail.payments[0]?.method || 'Sin pago'}</span></div>
        {saleDetail.customer && <div className="customer-history-row"><div><strong>Datos del cliente</strong><small>{saleDetail.customer.document_number ? formatCustomerDocument(saleDetail.customer.document_number) : 'Sin documento'}{saleDetail.customer.email ? ` · ${saleDetail.customer.email}` : ''}{saleDetail.customer.phone ? ` · ${saleDetail.customer.phone}` : ''}</small></div></div>}
        {saleDetail.items.map((item) => <div className="customer-history-row" key={item.id}><div><strong>{item.product_name}</strong><small>{item.quantity} × {currency(item.unit_price)}</small></div><strong>{currency(item.line_total)}</strong></div>)}
        {saleDetail.notes && <div className="customer-history-row"><div><strong>Notas de seguimiento</strong><small>{saleDetail.notes}</small></div></div>}
      </div>
    </Modal>}
  </>
}
