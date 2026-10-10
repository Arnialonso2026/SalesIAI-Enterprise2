import { FormEvent, useEffect, useState } from 'react'
import { Search, Plus, Users, Mail, Phone, History, Pencil, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../api'
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../App'
import type { Customer, CustomerSalesSummary, Sale } from '../types'
import { currency, dateShort, dateTime, formatCustomerDocument } from '../utils'
import { useRealtimeRefresh } from '../useRealtimeRefresh'

const blank = { name: '', email: '', phone: '', document_number: '', address: '', customer_type: 'individual', contact_name: '', industry: '', preferred_contact_method: 'whatsapp', notes: '' }

export default function CustomersPage() {
  const { user } = useAuth()
  const canManageCustomers = user?.role === 'admin' || user?.role === 'seller'
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [customerSales, setCustomerSales] = useState<Sale[]>([])
  const [customerSummary, setCustomerSummary] = useState<CustomerSalesSummary | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  async function loadCustomers(term = search) {
    setLoading(true)
    try { const { data } = await api.get<Customer[]>('/customers', { params: { search: term } }); setCustomers(data); setError('') }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void loadCustomers('') }, [])
  useRealtimeRefresh(() => loadCustomers())

  function editCustomer(customer: Customer) {
    setEditingCustomer(customer)
    setForm({ name: customer.name, email: customer.email ?? '', phone: customer.phone ?? '', document_number: customer.document_number?.replace(/\D/g, '') ?? '', address: customer.address ?? '', customer_type: customer.customer_type, contact_name: customer.contact_name ?? '', industry: customer.industry ?? '', preferred_contact_method: customer.preferred_contact_method, notes: customer.notes ?? '' })
    setOpen(true)
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { ...form, email: form.email || null, phone: form.phone || null, document_number: form.document_number || null, address: form.address || null, contact_name: form.contact_name || null, industry: form.industry || null, notes: form.notes || null }
      if (editingCustomer) await api.put(`/customers/${editingCustomer.id}`, payload)
      else await api.post('/customers', payload)
      setOpen(false); setEditingCustomer(null); setForm(blank); await loadCustomers()
    } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  async function deactivateCustomer(customer: Customer) {
    if (!window.confirm(`¿Desactivar a ${customer.name}? Su historial de ventas se conservará.`)) return
    try { await api.delete(`/customers/${customer.id}`); await loadCustomers() }
    catch (cause) { setError(errorMessage(cause)) }
  }

  async function showHistory(customer: Customer) {
    setHistoryCustomer(customer); setCustomerSales([]); setCustomerSummary(null); setHistoryLoading(true)
    try {
      const [historyResponse, summaryResponse] = await Promise.all([
        api.get<Sale[]>(`/customers/${customer.id}/sales`),
        api.get<CustomerSalesSummary>(`/customers/${customer.id}/summary`),
      ])
      setCustomerSales(historyResponse.data); setCustomerSummary(summaryResponse.data)
    }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setHistoryLoading(false) }
  }

  return <>
    <PageHeader eyebrow="RELACIONES COMERCIALES" title="Clientes" description="Conoce y gestiona a las personas y empresas que confían en tu negocio." action={canManageCustomers && <button className="button button-primary" onClick={() => { setEditingCustomer(null); setForm(blank); setOpen(true) }}><Plus size={17} /> Nuevo cliente</button>} />
    {error && <ErrorMessage message={error} />}
    <section className="panel table-panel"><div className="table-toolbar"><div className="table-heading"><div className="table-icon customers-icon"><Users size={18} /></div><div><strong>Directorio de clientes</strong><span>{customers.length} contactos registrados</span></div></div><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); void loadCustomers(event.target.value) }} placeholder="Buscar cliente…" /></label></div>
      {loading ? <Loading /> : customers.length ? <div className="table-scroll"><table><thead><tr><th>CLIENTE</th><th>CONTACTO</th><th>DNI / RUC</th><th>DESDE</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><div className="customer-cell"><span className="customer-avatar">{customer.name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div><strong>{customer.name}</strong><small>{customer.customer_type === 'business' ? 'Empresa' : 'Persona'} · {customer.industry || customer.address || 'Sin sector registrado'}</small>{customer.contact_name && <small>Contacto: {customer.contact_name}</small>}</div></div></td><td><div className="contact-lines">{customer.email && <span><Mail size={13} />{customer.email}</span>}{customer.phone && <span><Phone size={13} />{customer.phone}</span>}</div></td><td><span className="document-code">{customer.document_number ? formatCustomerDocument(customer.document_number) : '—'}</span></td><td>{dateShort(customer.created_at.slice(0, 10))}</td><td><span className="status-pill status-active"><i /> Activo</span></td><td><div className="row-actions"><button className="icon-button" onClick={() => void showHistory(customer)} aria-label={`Ver historial de ${customer.name}`}><History size={15} /></button>{canManageCustomers && <><button className="icon-button" onClick={() => editCustomer(customer)} aria-label={`Editar ${customer.name}`}><Pencil size={15} /></button><button className="icon-button danger-action" onClick={() => void deactivateCustomer(customer)} aria-label={`Desactivar ${customer.name}`}><Trash2 size={16} /></button></>}</div></td></tr>)}</tbody></table></div> : <EmptyState title="Aún no hay clientes" description="Agrega tu primer contacto comercial para empezar a registrar su actividad." />}
    </section>
    <div className="table-footnote">La información de cada cliente se asocia a sus ventas y actividad comercial.</div>
    {open && <Modal title={editingCustomer ? 'Editar cliente' : 'Nuevo cliente'} description="Completa los datos para mantener actualizada tu cartera comercial." onClose={() => { setOpen(false); setEditingCustomer(null) }} onSubmit={saveCustomer} submitLabel={saving ? 'Guardando…' : editingCustomer ? 'Guardar cambios' : 'Guardar cliente'}><div className="form-grid"><label className="form-field span-2">Nombre o razón social<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} required placeholder="Ej. María Fernández" /></label><label className="form-field">Tipo de cliente<select value={form.customer_type} onChange={(event) => setForm({ ...form, customer_type: event.target.value })}><option value="individual">Persona</option><option value="business">Empresa</option></select></label><label className="form-field">{form.customer_type === 'business' ? 'RUC' : 'DNI'}<input inputMode="numeric" maxLength={form.customer_type === 'business' ? 11 : 8} value={form.document_number} onChange={(event) => setForm({ ...form, document_number: event.target.value.replace(/\D/g, '').slice(0, form.customer_type === 'business' ? 11 : 8) })} placeholder={form.customer_type === 'business' ? '11 dígitos (opcional)' : '8 dígitos (opcional)'} /></label><label className="form-field">Persona de contacto<input value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} maxLength={160} placeholder="Nombre del contacto" /></label><label className="form-field">Sector o actividad<input value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} maxLength={120} placeholder="Ej. Comercio, tecnología" /></label><label className="form-field">Correo electrónico<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="correo@ejemplo.com" /></label><label className="form-field">Teléfono<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+51 900 000 000" /></label><label className="form-field">Dirección<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} maxLength={255} placeholder="Ciudad, dirección" /></label><label className="form-field">Canal preferido<select value={form.preferred_contact_method} onChange={(event) => setForm({ ...form, preferred_contact_method: event.target.value })}><option value="whatsapp">WhatsApp</option><option value="phone">Teléfono</option><option value="email">Correo electrónico</option></select></label><label className="form-field span-2">Notas comerciales<textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Preferencias, condiciones o acuerdos importantes" /></label></div></Modal>}
    {historyCustomer && <Modal title={`Historial · ${historyCustomer.name}`} description="Compras, gasto acumulado y última actividad comercial." onClose={() => setHistoryCustomer(null)} onSubmit={(event) => event.preventDefault()} hideActions><div className="customer-history">{historyLoading ? <Loading label="Consultando compras…" /> : <>{customerSummary && <div className="sales-summary-row"><div className="sales-summary-card"><div><small>Compras</small><strong>{customerSummary.sales_count}</strong></div></div><div className="sales-summary-card"><div><small>Total comprado</small><strong>{currency(customerSummary.total_spent)}</strong></div></div><div className="sales-summary-card"><div><small>Ticket promedio</small><strong>{currency(customerSummary.average_ticket)}</strong></div></div></div>}{customerSummary?.last_purchase_at && <div className="table-footnote">Última compra: {dateTime(customerSummary.last_purchase_at)}</div>}{customerSales.length ? customerSales.map((sale) => <div className="customer-history-row" key={sale.id}><div><strong>{sale.sale_number}</strong><small>{dateTime(sale.created_at)} · {sale.items.length} productos</small></div><strong>{currency(sale.total)}</strong></div>) : <EmptyState title="Sin compras registradas" description="Las ventas asociadas a este cliente aparecerán aquí." />}</>}</div></Modal>}
  </>
}
