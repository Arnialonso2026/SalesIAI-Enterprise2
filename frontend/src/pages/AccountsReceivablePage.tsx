import { FormEvent, useEffect, useState } from 'react'
import { CircleDollarSign, CreditCard, Search, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../App'
import type { Receivable } from '../types'
import { currency, dateTime } from '../utils'
import { useRealtimeRefresh } from '../useRealtimeRefresh'
import './accounts-receivable.css'

const PAGE_SIZE = 100

export default function AccountsReceivablePage() {
  const { user } = useAuth()
  const canRegisterPayment = user?.role === 'admin' || user?.role === 'seller'
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [salesHistory, setSalesHistory] = useState<Receivable[]>([])
  const [selected, setSelected] = useState<Receivable | null>(null)
  const [activeSection, setActiveSection] = useState<'receivables' | 'history'>('receivables')
  const [historySearch, setHistorySearch] = useState('')
  const [historyPaymentStatus, setHistoryPaymentStatus] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [receivableResponse, historyResponse] = await Promise.all([
        api.get<Receivable[]>('/sales/accounts-receivable', {
          params: { limit: PAGE_SIZE, offset: 0 },
        }),
        api.get<Receivable[]>('/sales/history', {
          params: { limit: PAGE_SIZE, offset: 0 },
        }),
      ])
      setReceivables(receivableResponse.data)
      setSalesHistory(historyResponse.data)
      setHasMore(receivableResponse.data.length === PAGE_SIZE)
      setHasMoreHistory(historyResponse.data.length === PAGE_SIZE)
      setError('')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setLoading(false) }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const { data } = await api.get<Receivable[]>('/sales/accounts-receivable', {
        params: { limit: PAGE_SIZE, offset: receivables.length },
      })
      setReceivables((current) => [...current, ...data])
      setHasMore(data.length === PAGE_SIZE)
      setError('')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setLoadingMore(false) }
  }

  async function loadMoreHistory() {
    if (loadingMoreHistory || !hasMoreHistory) return
    setLoadingMoreHistory(true)
    try {
      const { data } = await api.get<Receivable[]>('/sales/history', {
        params: { limit: PAGE_SIZE, offset: salesHistory.length },
      })
      setSalesHistory((current) => [...current, ...data])
      setHasMoreHistory(data.length === PAGE_SIZE)
      setError('')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setLoadingMoreHistory(false) }
  }

  useEffect(() => { void load() }, [])
  useRealtimeRefresh(() => { void load() })

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const paymentAmount = Number(amount)
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > selected.balance) {
      setError(`El abono debe ser mayor que cero y no superar ${currency(selected.balance)}.`)
      return
    }

    setSaving(true)
    setError('')
    try {
      await api.post(`/sales/${selected.sale.id}/payments`, { amount: paymentAmount, method })
      setSelected(null)
      setAmount('')
      await load()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false) }
  }

  const outstandingTotal = receivables.reduce((sum, item) => sum + item.balance, 0)
  const filteredHistory = salesHistory.filter((item) => {
    const searchTerm = historySearch.trim().toLocaleLowerCase()
    const matchesSearch = !searchTerm || [
      item.sale.sale_number,
      item.sale.customer?.name,
      item.sale.customer?.document_number,
      item.sale.created_by?.full_name,
    ].some((value) => value?.toLocaleLowerCase().includes(searchTerm))
    const paidAmount = item.paid_amount
    const paymentStatus = item.sale.status === 'cancelled'
      ? 'cancelled'
      : item.balance <= 0
        ? 'paid'
        : paidAmount > 0
          ? 'partial'
          : 'pending'
    return matchesSearch && (!historyPaymentStatus || paymentStatus === historyPaymentStatus)
  })
  const historyPaidStatus = (item: Receivable) => item.sale.status === 'cancelled'
    ? { label: 'Anulada', className: 'status-low' }
    : item.balance <= 0
      ? { label: 'Pagada', className: 'status-completed' }
      : item.paid_amount > 0
        ? { label: 'Pago parcial', className: 'status-partial-payment' }
        : { label: 'Pendiente de pago', className: 'status-low' }

  return <>
    <PageHeader eyebrow="VENTAS Y COBRANZAS" title="Cuentas por cobrar" description="Consulta el historial de ventas y administra los saldos y pagos de cada orden." action={<Link className="button button-primary" to="/ventas/nueva"><ShoppingBag size={16} /> Nueva venta</Link>} />
    {error && <ErrorMessage message={error} />}
    <div className="sales-summary-row">
      <div className="sales-summary-card"><span className="summary-icon"><CreditCard size={18} /></span><div><small>Ventas pendientes</small><strong>{receivables.length}</strong></div></div>
      <div className="sales-summary-card"><span className="summary-icon summary-icon-green"><CircleDollarSign size={18} /></span><div><small>Saldo pendiente mostrado</small><strong>{currency(outstandingTotal)}</strong></div></div>
    </div>
    <div className="receivables-tabs" role="tablist" aria-label="Ventas y cuentas por cobrar">
      <button type="button" role="tab" aria-selected={activeSection === 'receivables'} className={activeSection === 'receivables' ? 'active' : ''} onClick={() => setActiveSection('receivables')}>
        <CreditCard size={15} /> Saldos pendientes <span>{receivables.length}</span>
      </button>
      <button type="button" role="tab" aria-selected={activeSection === 'history'} className={activeSection === 'history' ? 'active' : ''} onClick={() => setActiveSection('history')}>
        <ShoppingBag size={15} /> Historial de ventas <span>{salesHistory.length}</span>
      </button>
    </div>
    {activeSection === 'receivables' && <>
    <section className="panel table-panel">
      <div className="table-toolbar"><div className="table-heading"><div className="table-icon sales-icon"><CreditCard size={18} /></div><div><strong>Saldos pendientes</strong><span>Los abonos se conservan en el historial de pagos de la venta</span></div></div></div>
      {loading ? <Loading /> : receivables.length ? <div className="table-scroll"><table><thead><tr><th>N.º DE ORDEN</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL</th><th>ABONADO</th><th>SALDO</th>{canRegisterPayment && <th>ACCIÓN</th>}</tr></thead><tbody>
        {receivables.map((item) => <tr key={item.sale.id}>
          <td><span className="sale-number">{item.sale.sale_number}</span></td>
          <td><div className="simple-cell"><strong>{item.sale.customer?.name || 'Venta mostrador'}</strong><small>{item.sale.created_by?.full_name || 'Usuario no disponible'}</small></div></td>
          <td>{dateTime(item.sale.created_at)}</td>
          <td>{currency(item.sale.total)}</td>
          <td>{currency(item.paid_amount)}</td>
          <td><strong className="stock-value-low">{currency(item.balance)}</strong></td>
          {canRegisterPayment && <td><button className="button button-small button-secondary" type="button" onClick={() => { setSelected(item); setAmount(''); setMethod('cash') }}>Registrar abono</button></td>}
        </tr>)}
      </tbody></table></div> : <EmptyState title="Sin saldos pendientes" description="Las ventas con pago parcial aparecerán aquí hasta que se complete su saldo." />}
      {hasMore && <div className="movement-pagination"><span>{receivables.length} cuentas cargadas</span><button className="button button-secondary button-small" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Cargando…' : 'Cargar más cuentas'}</button></div>}
    </section>
    </>}
    {activeSection === 'history' && <section className="panel table-panel sales-ledger-panel">
      <div className="table-toolbar">
        <div className="table-heading"><div className="table-icon sales-icon"><ShoppingBag size={18} /></div><div><strong>Historial de ventas</strong><span>El estado refleja lo abonado, no solo el registro de la orden.</span></div></div>
        <label className="search-field"><Search size={16} /><input aria-label="Buscar en el historial de ventas" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Orden, cliente, DNI/RUC o vendedor…" /></label>
      </div>
      <div className="sales-filter-bar">
        <label className="sales-filter-field">Estado del pago<select aria-label="Filtrar por estado de pago" value={historyPaymentStatus} onChange={(event) => setHistoryPaymentStatus(event.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente de pago</option>
          <option value="partial">Pago parcial</option>
          <option value="paid">Pagada</option>
          <option value="cancelled">Anulada</option>
        </select></label>
      </div>
      {loading ? <Loading /> : filteredHistory.length ? <div className="table-scroll"><table><thead><tr><th>N.º DE ORDEN</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL</th><th>ABONADO</th><th>SALDO</th><th>ESTADO DEL PAGO</th>{canRegisterPayment && <th>ACCIÓN</th>}</tr></thead><tbody>
        {filteredHistory.map((item) => {
          const paymentStatus = historyPaidStatus(item)
          return <tr key={item.sale.id}>
            <td><span className="sale-number">{item.sale.sale_number}</span></td>
            <td><div className="simple-cell"><strong>{item.sale.customer?.name || 'Venta mostrador'}</strong><small>{item.sale.created_by?.full_name || 'Usuario no disponible'}</small></div></td>
            <td>{dateTime(item.sale.created_at)}</td>
            <td>{currency(item.sale.total)}</td>
            <td>{currency(item.paid_amount)}</td>
            <td>{currency(item.balance)}</td>
            <td><span className={`status-pill ${paymentStatus.className}`}>{paymentStatus.label}</span></td>
            {canRegisterPayment && <td>{item.balance > 0 && item.sale.status !== 'cancelled' ? <button className="button button-small button-secondary" type="button" onClick={() => { setSelected(item); setAmount(''); setMethod('cash') }}>Registrar abono</button> : '—'}</td>}
          </tr>
        })}
      </tbody></table></div> : <EmptyState title={historySearch || historyPaymentStatus ? 'No se encontraron ventas' : 'Todavía no hay ventas'} description={historySearch || historyPaymentStatus ? 'Prueba otros términos o cambia el estado del pago.' : 'Registra una venta para iniciar el historial.'} />}
      {hasMoreHistory && <div className="movement-pagination"><span>{salesHistory.length} ventas cargadas</span><button className="button button-secondary button-small" type="button" disabled={loadingMoreHistory} onClick={() => void loadMoreHistory()}>{loadingMoreHistory ? 'Cargando…' : 'Cargar más ventas'}</button></div>}
    </section>}
    {selected && <Modal title={`Registrar abono · ${selected.sale.sale_number}`} description={`Saldo pendiente: ${currency(selected.balance)}`} onClose={() => setSelected(null)} onSubmit={submitPayment} submitLabel={saving ? 'Registrando…' : 'Guardar abono'}>
      <div className="form-grid">
        <label className="form-field span-2">Importe del abono<input autoFocus type="number" min="0.01" max={selected.balance} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label className="form-field span-2">Método de pago<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="transfer">Transferencia</option><option value="wallet">Billetera digital</option></select></label>
      </div>
    </Modal>}
  </>
}
