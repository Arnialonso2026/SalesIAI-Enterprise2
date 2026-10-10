import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Minus, Plus, ReceiptText, Search, ShoppingBag, Trash2, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { ErrorMessage } from '../components/Feedback'
import PageHeader from '../components/PageHeader'
import type { Customer, CustomerSalesSummary, Product, Sale } from '../types'
import { currency, formatCustomerDocument } from '../utils'
import { useRealtimeRefresh } from '../useRealtimeRefresh'
import './new-sale.css'

type CartLine = { product: Product; quantity: number }
type DocumentCustomer = {
  name: string
  customer_type: Customer['customer_type']
  document_number: string
  address: string
  email: string
  phone: string
}
const TAX_RATE = 0.18

export default function NewSalePage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSummary, setCustomerSummary] = useState<CustomerSalesSummary | null>(null)
  const [customerSummaryLoading, setCustomerSummaryLoading] = useState(false)
  const [customerSummaryError, setCustomerSummaryError] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [documentType, setDocumentType] = useState<'boleta' | 'factura'>('boleta')
  const [documentCustomer, setDocumentCustomer] = useState<DocumentCustomer>({
    name: 'Cliente de mostrador',
    customer_type: 'individual',
    document_number: '',
    address: '',
    email: '',
    phone: '',
  })
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerId, setCustomerId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [receiptReviewOpen, setReceiptReviewOpen] = useState(false)
  const [discount, setDiscount] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial'>('full')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadSaleOptions() {
    try {
      const [productResponse, customerResponse] = await Promise.all([api.get<Product[]>('/products'), api.get<Customer[]>('/customers')])
      setProducts(productResponse.data)
      setCustomers(customerResponse.data)
      setCart((current) => current.map((line) => {
        const latestProduct = productResponse.data.find((product) => product.id === line.product.id)
        return latestProduct ? { ...line, product: latestProduct } : line
      }))
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }
  useEffect(() => { void loadSaleOptions() }, [])
  useRealtimeRefresh(() => loadSaleOptions())

  useEffect(() => {
    if (!productPickerOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setProductPickerOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [productPickerOpen])

  useEffect(() => {
    if (!receiptReviewOpen || saving) return
    function closeReviewOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setReceiptReviewOpen(false)
    }
    document.addEventListener('keydown', closeReviewOnEscape)
    return () => document.removeEventListener('keydown', closeReviewOnEscape)
  }, [receiptReviewOpen, saving])

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0), [cart])
  const discountAmount = Math.min(subtotal, Math.max(0, Number(discount) || 0))
  const tax = Math.round((subtotal - discountAmount) * TAX_RATE * 100) / 100
  const total = subtotal - discountAmount + tax
  const selectedCustomer = customers.find((customer) => customer.id === Number(customerId))
  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLocaleLowerCase()
    return products.filter((product) => product.stock > 0 && (!term || [
      product.name, product.sku, product.category?.name,
    ].some((value) => value?.toLocaleLowerCase().includes(term))))
  }, [productSearch, products])
  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLocaleLowerCase()
    const matches = customers.filter((customer) => !term || [
      customer.name, customer.document_number, customer.email, customer.phone,
    ].some((value) => value?.toLocaleLowerCase().includes(term)))
    if (selectedCustomer && !matches.some((customer) => customer.id === selectedCustomer.id)) {
      return [selectedCustomer, ...matches]
    }
    return matches
  }, [customerSearch, customers, selectedCustomer])

  useEffect(() => {
    setDocumentCustomer(selectedCustomer ? {
      name: selectedCustomer.name,
      customer_type: selectedCustomer.customer_type,
      document_number: selectedCustomer.document_number ?? '',
      address: selectedCustomer.address ?? '',
      email: selectedCustomer.email ?? '',
      phone: selectedCustomer.phone ?? '',
    } : {
      name: 'Cliente de mostrador',
      customer_type: 'individual',
      document_number: '',
      address: '',
      email: '',
      phone: '',
    })
  }, [customerId, selectedCustomer])

  useEffect(() => {
    if (!customerId) {
      setCustomerSummary(null)
      setCustomerSummaryLoading(false)
      setCustomerSummaryError(false)
      return
    }

    let active = true
    setCustomerSummary(null)
    setCustomerSummaryError(false)
    setCustomerSummaryLoading(true)
    api.get<CustomerSalesSummary>(`/customers/${customerId}/summary`)
      .then(({ data }) => { if (active) setCustomerSummary(data) })
      .catch(() => { if (active) setCustomerSummaryError(true) })
      .finally(() => { if (active) setCustomerSummaryLoading(false) })

    return () => { active = false }
  }, [customerId])

  function addProduct(product: Product) {
    const inCart = cart.find((line) => line.product.id === product.id)?.quantity ?? 0
    if (inCart + 1 > product.stock) { setError(`Stock insuficiente para ${product.name}. Disponible: ${product.stock - inCart}.`); return }
    setError('')
    setCart((current) => current.some((line) => line.product.id === product.id)
      ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
      : [...current, { product, quantity: 1 }])
  }

  function setLineQuantity(productIdValue: number, next: number) {
    setCart((current) => current.flatMap((line) => {
      if (line.product.id !== productIdValue) return [line]
      if (next <= 0) return []
      if (next > line.product.stock) { setError(`Stock máximo disponible: ${line.product.stock}.`); return [line] }
      setError('')
      return [{ ...line, quantity: next }]
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cart.length) { setError('Agrega al menos un producto para registrar la venta.'); return }
    if (Number(discount) > subtotal) { setError('El descuento no puede superar el subtotal.'); return }
    const initialPayment = paymentMode === 'partial' ? Number(paymentAmount) : undefined
    if (paymentMode === 'partial' && (!initialPayment || initialPayment <= 0 || initialPayment > total)) {
      setError('El abono inicial debe ser mayor que cero y no superar el total de la venta.')
      return
    }
    if (documentType === 'factura' && (
      documentCustomer.customer_type !== 'business' || !/^\d{11}$/.test(documentCustomer.document_number)
    )) {
      setError('Para emitir factura, selecciona una empresa e ingresa un RUC válido de 11 dígitos.')
      return
    }
    setError('')
    setReceiptReviewOpen(true)
  }

  async function confirmSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cart.length) {
      setError('Agrega al menos un producto para registrar la venta.')
      return
    }
    if (Number(discount) > subtotal) {
      setError('El descuento no puede superar el subtotal.')
      return
    }
    const initialPayment = paymentMode === 'partial' ? Number(paymentAmount) : undefined
    if (paymentMode === 'partial' && (!initialPayment || initialPayment <= 0 || initialPayment > total)) {
      setError('El abono inicial debe ser mayor que cero y no superar el total de la venta.')
      return
    }
    if (documentType === 'factura' && (
      documentCustomer.customer_type !== 'business' || !/^\d{11}$/.test(documentCustomer.document_number)
    )) {
      setError('Para emitir factura, selecciona una empresa e ingresa un RUC válido de 11 dígitos.')
      return
    }
    setSaving(true); setError('')
    try {
      const { data } = await api.post<Sale>('/sales', {
        customer_id: customerId ? Number(customerId) : null,
        items: cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
        discount: Number(discount), payment_method: paymentMethod,
        payment_amount: initialPayment ?? null,
        notes: followUpNotes.trim() || null,
        document_type: documentType,
        document_customer: {
          ...documentCustomer,
          document_number: documentCustomer.document_number || null,
          address: documentCustomer.address || null,
          email: documentCustomer.email || null,
          phone: documentCustomer.phone || null,
        },
      })
      navigate('/comprobantes-pago', { state: { createdDocument: data.document?.document_number } })
    } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  return <>
    <PageHeader eyebrow="OPERACIÓN COMERCIAL" title="Orden de venta" description="Valida existencias, registra los datos del cliente y confirma la operación." action={<Link className="button button-quiet" to="/cuentas-cobrar"><ArrowLeft size={16} /> Volver a ventas y cobros</Link>} />
    {error && <ErrorMessage message={error} />}
    <form className="sale-layout" onSubmit={submit}>
      <section className="panel sale-step-panel sale-products-panel" aria-label="Detalle de productos"><div className="sale-section-heading"><span className="step-number">01</span><div><h2>Detalle de productos</h2><p>Busca por código o descripción y agrega artículos a la orden.</p></div></div><button className="product-picker-trigger" type="button" onClick={() => { setProductSearch(''); setProductPickerOpen(true) }}><Search size={17} /><span>Buscar producto por código o descripción</span><span className="product-picker-shortcut">Seleccionar</span></button>
        {cart.length ? <div className="cart-list"><div className="cart-table-head"><span>ARTÍCULO</span><span>PRECIO</span><span>CANTIDAD</span><span>IMPORTE</span><span /></div>{cart.map((line) => <div className="cart-row" key={line.product.id}><div className="cart-product"><span className="cart-product-icon"><ShoppingBag size={17} /></span><div><strong>{line.product.name}</strong><small>{line.product.sku} · {line.product.stock} disponibles</small></div></div><span className="cart-unit">{currency(line.product.price)}</span><div className="quantity-control"><button type="button" onClick={() => setLineQuantity(line.product.id, line.quantity - 1)} aria-label="Reducir"><Minus size={13} /></button><span>{line.quantity}</span><button type="button" onClick={() => setLineQuantity(line.product.id, line.quantity + 1)} aria-label="Aumentar"><Plus size={13} /></button></div><strong className="cart-line-total">{currency(line.product.price * line.quantity)}</strong><button type="button" className="icon-button remove-button" onClick={() => setLineQuantity(line.product.id, 0)} aria-label="Quitar producto"><Trash2 size={16} /></button></div>)}</div> : <div className="cart-empty"><ShoppingBag size={21} /><span>Tu venta está vacía. Agrega un producto para comenzar.</span></div>}
      </section>
      <section className="panel sale-step-panel sale-customer-panel" aria-label="Datos del cliente y operación"><div className="sale-section-heading"><span className="step-number">02</span><div><h2>Datos del cliente</h2><p>Busca, selecciona y edita los datos para este comprobante.</p></div></div><div className="sale-data-fields">
          <label className="form-field customer-search-field">Buscar cliente<div className="input-with-icon"><Search size={16} /><input type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Nombre, DNI/RUC, correo o teléfono" /></div></label>
          <label className="form-field">Cliente<select aria-label="Cliente" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Venta mostrador · Sin cliente</option>{filteredCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.document_number ? ` · ${formatCustomerDocument(customer.document_number)}` : ''}</option>)}</select></label>
          <div className="sale-customer-edit-form" aria-label="Formulario de datos editables del cliente">
            <label className="form-field">Nombre o razón social<input aria-label="Nombre o razón social" value={documentCustomer.name} onChange={(event) => setDocumentCustomer((current) => ({ ...current, name: event.target.value }))} required minLength={2} maxLength={160} /></label>
            <label className="form-field">Tipo de cliente<select aria-label="Tipo de cliente" value={documentCustomer.customer_type} onChange={(event) => setDocumentCustomer((current) => ({ ...current, customer_type: event.target.value as Customer['customer_type'], document_number: '' }))}><option value="individual">Persona</option><option value="business">Empresa</option></select></label>
            <label className="form-field">{documentCustomer.customer_type === 'business' ? 'RUC' : 'DNI'}<input aria-label={documentCustomer.customer_type === 'business' ? 'RUC' : 'DNI'} inputMode="numeric" maxLength={documentCustomer.customer_type === 'business' ? 11 : 8} value={documentCustomer.document_number} onChange={(event) => setDocumentCustomer((current) => ({ ...current, document_number: event.target.value.replace(/\D/g, '').slice(0, current.customer_type === 'business' ? 11 : 8) }))} /></label>
            <label className="form-field">Dirección<input aria-label="Dirección del cliente" value={documentCustomer.address} onChange={(event) => setDocumentCustomer((current) => ({ ...current, address: event.target.value }))} maxLength={255} /></label>
            <label className="form-field">Correo electrónico<input aria-label="Correo del cliente" type="email" value={documentCustomer.email} onChange={(event) => setDocumentCustomer((current) => ({ ...current, email: event.target.value }))} maxLength={255} /></label>
            <label className="form-field">Teléfono<input aria-label="Teléfono del cliente" type="tel" value={documentCustomer.phone} onChange={(event) => setDocumentCustomer((current) => ({ ...current, phone: event.target.value }))} maxLength={40} /></label>
          </div>
          <label className="form-field sale-document-field">Tipo de comprobante<select aria-label="Tipo de comprobante" value={documentType} onChange={(event) => setDocumentType(event.target.value as 'boleta' | 'factura')}><option value="boleta">Boleta interna</option><option value="factura">Factura interna</option></select></label>
          {documentType === 'factura' && (documentCustomer.customer_type !== 'business' || !/^\d{11}$/.test(documentCustomer.document_number)) && <p className="sale-invoice-hint" role="status">Para factura se requiere una empresa con RUC de 11 dígitos.</p>}
          <label className="form-field sale-payment-field">Tipo de pago<select aria-label="Tipo de pago" value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as 'full' | 'partial')}><option value="full">Pago completo</option><option value="partial">Abono parcial</option></select></label>{paymentMode === 'partial' && <><label className="form-field sale-partial-payment-field">Abono inicial<input aria-label="Abono inicial" type="number" min="0.01" max={total} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required placeholder="Importe recibido" /></label><label className="form-field sale-partial-payment-field">Método del abono<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="transfer">Transferencia</option><option value="wallet">Billetera digital</option></select></label></>}</div>
          {customerSummaryLoading && <div className="sale-customer-summary-state" role="status">Consultando historial de ventas…</div>}
          {customerSummaryError && <div className="sale-customer-summary-state">No se pudo consultar el historial de ventas.</div>}
          {customerSummary && <>
            <dl className="sale-customer-metrics" aria-label="Resumen de compras del cliente">
              <div><dt>Compras</dt><dd>{customerSummary.sales_count}</dd></div>
              <div><dt>Total comprado</dt><dd>{currency(customerSummary.total_spent)}</dd></div>
              <div><dt>Ticket promedio</dt><dd>{currency(customerSummary.average_ticket)}</dd></div>
            </dl>
            <div className="sale-customer-last-purchase">{customerSummary.last_purchase_at ? 'Cliente con historial comercial' : 'Primera venta de este cliente'}</div>
          </>}
        <label className="form-field">Notas de seguimiento<textarea rows={3} maxLength={500} value={followUpNotes} onChange={(event) => setFollowUpNotes(event.target.value)} placeholder="Acuerdos, entrega o próxima acción con el cliente" /></label>
      </section>
      <aside className="panel sale-summary-panel" aria-label="Resumen de la orden de venta"><div className="summary-heading"><span className="summary-receipt-icon"><ReceiptText size={18} /></span><div><h2>Resumen</h2><p>Totales de la operación</p></div></div><div className="summary-lines"><div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div><label className="discount-line"><span>Descuento</span><span className="discount-input"><span>S/</span><input type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></span></label><div><span>IGV (18%)</span><strong>{currency(tax)}</strong></div></div><div className="summary-total"><span>Total a cobrar</span><strong>{currency(total)}</strong></div><div className="summary-payment-note"><Check size={15} /><span>{paymentMode === 'partial' && Number(paymentAmount) > 0 && Number(paymentAmount) < total ? `Saldo pendiente: ${currency(total - Number(paymentAmount))}` : 'El pago se registrará como completado.'}</span></div><button className="button button-primary complete-sale-button" disabled={saving || cart.length === 0}><ReceiptText size={16} /> Revisar comprobante</button><p className="summary-footnote">Antes de registrar la venta, podrás comprobar el comprobante y corregir los datos.</p></aside>
    </form>
    {productPickerOpen && <div className="product-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setProductPickerOpen(false) }}>
      <section className="product-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="product-picker-title">
        <div className="product-picker-heading"><div><h2 id="product-picker-title">Seleccionar producto</h2><p>Haz clic en un producto para agregarlo a la orden.</p></div><button type="button" className="icon-button" onClick={() => setProductPickerOpen(false)} aria-label="Cerrar"><X size={18} /></button></div>
        <label className="product-picker-search"><Search size={17} /><input autoFocus aria-label="Buscar por código o descripción" type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar por código o descripción" /></label>
        {error && <ErrorMessage message={error} />}
        <div className="product-picker-list">
          {filteredProducts.length ? filteredProducts.map((product) => {
            const inCart = cart.find((line) => line.product.id === product.id)?.quantity ?? 0
            return <button className="product-picker-item" type="button" key={product.id} onClick={() => addProduct(product)} aria-label={`Agregar ${product.name}`}>
              <span className="product-picker-item-main"><strong>{product.name}</strong><small>{product.sku} · Stock: {product.stock} · En orden: {inCart}</small></span>
              <span className="product-picker-item-price">{currency(product.price)}</span><Plus size={18} />
            </button>
          }) : <p className="product-picker-empty">No hay productos disponibles que coincidan con la búsqueda.</p>}
        </div>
      </section>
    </div>}
    {receiptReviewOpen && <div className="receipt-review-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setReceiptReviewOpen(false) }}>
      <form className="receipt-review-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-review-title" onSubmit={(event) => void confirmSale(event)}>
        <header className="receipt-review-header">
          <div><span>REVISIÓN ANTES DE EMITIR</span><h2 id="receipt-review-title">Comprobante de pago</h2><p>Comprueba los datos y corrige cualquier error antes de confirmar la venta.</p></div>
          <button type="button" className="icon-button" aria-label="Cerrar" disabled={saving} onClick={() => setReceiptReviewOpen(false)}><X size={18} /></button>
        </header>
        <div className="receipt-review-content">
          <section className="receipt-review-items">
            <div className="receipt-review-section-title"><strong>Detalle del comprobante</strong><span>{cart.length} producto{cart.length === 1 ? '' : 's'}</span></div>
            <div className="receipt-review-table-scroll"><table className="receipt-review-table">
              <thead><tr><th>Producto</th><th>Cant.</th><th>Unidad</th><th>Importe</th><th /></tr></thead>
              <tbody>{cart.map((line) => <tr key={line.product.id}>
                <td><strong>{line.product.sku}</strong><small>{line.product.name}</small></td>
                <td>{line.quantity}</td><td>{currency(line.product.price)}</td><td>{currency(line.product.price * line.quantity)}</td>
                <td><div className="receipt-review-quantity">
                  <button type="button" aria-label={`Reducir ${line.product.name}`} disabled={saving} onClick={() => setLineQuantity(line.product.id, line.quantity - 1)}><Minus size={12} /></button>
                  <button type="button" aria-label={`Aumentar ${line.product.name}`} disabled={saving} onClick={() => setLineQuantity(line.product.id, line.quantity + 1)}><Plus size={12} /></button>
                </div></td>
              </tr>)}</tbody>
            </table></div>
          </section>
          <section className="receipt-review-customer">
            <div className="receipt-review-section-title"><strong>Datos del cliente y comprobante</strong><span>Puedes corregirlos antes de emitir.</span></div>
            <div className="receipt-review-fields">
              <label className="form-field">Tipo de comprobante<select aria-label="Tipo de comprobante a emitir" value={documentType} onChange={(event) => setDocumentType(event.target.value as 'boleta' | 'factura')}><option value="boleta">Boleta</option><option value="factura">Factura</option></select></label>
              <label className="form-field">Tipo de cliente<select aria-label="Tipo de cliente en comprobante" value={documentCustomer.customer_type} onChange={(event) => setDocumentCustomer((current) => ({ ...current, customer_type: event.target.value as Customer['customer_type'], document_number: '' }))}><option value="individual">Persona</option><option value="business">Empresa</option></select></label>
              <label className="form-field">Nombre o razón social<input aria-label="Nombre en comprobante" value={documentCustomer.name} onChange={(event) => setDocumentCustomer((current) => ({ ...current, name: event.target.value }))} required minLength={2} maxLength={160} /></label>
              <label className="form-field">{documentCustomer.customer_type === 'business' ? 'RUC' : 'DNI'}<input aria-label="Documento en comprobante" inputMode="numeric" maxLength={documentCustomer.customer_type === 'business' ? 11 : 8} value={documentCustomer.document_number} onChange={(event) => setDocumentCustomer((current) => ({ ...current, document_number: event.target.value.replace(/\D/g, '').slice(0, current.customer_type === 'business' ? 11 : 8) }))} /></label>
              <label className="form-field">Dirección<input aria-label="Dirección en comprobante" value={documentCustomer.address} onChange={(event) => setDocumentCustomer((current) => ({ ...current, address: event.target.value }))} maxLength={255} /></label>
              <label className="form-field">Correo electrónico<input aria-label="Correo en comprobante" type="email" value={documentCustomer.email} onChange={(event) => setDocumentCustomer((current) => ({ ...current, email: event.target.value }))} maxLength={255} /></label>
              <label className="form-field">Teléfono<input aria-label="Teléfono en comprobante" type="tel" value={documentCustomer.phone} onChange={(event) => setDocumentCustomer((current) => ({ ...current, phone: event.target.value }))} maxLength={40} /></label>
            </div>
            {documentType === 'factura' && (documentCustomer.customer_type !== 'business' || !/^\d{11}$/.test(documentCustomer.document_number)) && <p className="sale-invoice-hint" role="status">Para emitir factura se requiere una empresa con RUC válido de 11 dígitos.</p>}
          </section>
          <aside className="receipt-review-totals">
            <label className="form-field">Descuento<input aria-label="Descuento en comprobante" type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
            <div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
            <div><span>IGV (18%)</span><strong>{currency(tax)}</strong></div>
            <div className="receipt-review-total"><span>Total del comprobante</span><strong>{currency(total)}</strong></div>
            {paymentMode === 'partial' && <div><span>Abono inicial</span><strong>{currency(Number(paymentAmount) || 0)}</strong></div>}
          </aside>
        </div>
        {error && <div className="receipt-review-error"><ErrorMessage message={error} /></div>}
        <footer className="receipt-review-actions">
          <button type="button" className="button button-quiet" disabled={saving} onClick={() => setReceiptReviewOpen(false)}>Volver a la orden</button>
          <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Registrando venta…' : <>Confirmar venta y generar comprobante <Check size={16} /></>}</button>
        </footer>
      </form>
    </div>}
  </>
}
