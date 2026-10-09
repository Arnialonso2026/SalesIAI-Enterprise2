import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Minus, Plus, ReceiptText, ShoppingBag, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { ErrorMessage } from '../components/Feedback'
import PageHeader from '../components/PageHeader'
import type { Customer, Product, Sale } from '../types'
import { currency, formatCustomerDocument } from '../utils'
import { useRealtimeRefresh } from '../useRealtimeRefresh'

type CartLine = { product: Product; quantity: number }
const TAX_RATE = 0.18

export default function NewSalePage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerId, setCustomerId] = useState('')
  const [discount, setDiscount] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadSaleOptions(selectInitialProduct = false) {
    try {
      const [productResponse, customerResponse] = await Promise.all([api.get<Product[]>('/products'), api.get<Customer[]>('/customers')])
      setProducts(productResponse.data)
      setCustomers(customerResponse.data)
      setCart((current) => current.map((line) => {
        const latestProduct = productResponse.data.find((product) => product.id === line.product.id)
        return latestProduct ? { ...line, product: latestProduct } : line
      }))
      if (selectInitialProduct) {
        const firstAvailable = productResponse.data.find((product) => product.stock > 0)
        if (firstAvailable) setProductId(String(firstAvailable.id))
      }
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }
  useEffect(() => { void loadSaleOptions(true) }, [])
  useRealtimeRefresh(() => loadSaleOptions())

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0), [cart])
  const discountAmount = Math.min(subtotal, Math.max(0, Number(discount) || 0))
  const tax = Math.round((subtotal - discountAmount) * TAX_RATE * 100) / 100
  const total = subtotal - discountAmount + tax
  const selectedCustomer = customers.find((customer) => customer.id === Number(customerId))

  function addProduct() {
    const product = products.find((item) => item.id === Number(productId))
    const count = Number(quantity)
    if (!product || !Number.isInteger(count) || count <= 0) return
    const inCart = cart.find((line) => line.product.id === product.id)?.quantity ?? 0
    if (inCart + count > product.stock) { setError(`Stock insuficiente para ${product.name}. Disponible: ${product.stock - inCart}.`); return }
    setError('')
    setCart((current) => current.some((line) => line.product.id === product.id)
      ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + count } : line)
      : [...current, { product, quantity: count }])
    setQuantity('1')
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
    setSaving(true); setError('')
    try {
      const { data } = await api.post<Sale>('/sales', {
        customer_id: customerId ? Number(customerId) : null,
        items: cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
        discount: Number(discount), payment_method: paymentMethod,
        notes: followUpNotes.trim() || null,
      })
      navigate('/ventas', { state: { createdSale: data.sale_number } })
    } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  return <>
    <PageHeader eyebrow="OPERACIÓN COMERCIAL" title="Nueva venta" description="Agrega los productos, confirma el pago y registra la operación en un solo paso." action={<Link className="button button-quiet" to="/ventas"><ArrowLeft size={16} /> Volver a ventas</Link>} />
    {error && <ErrorMessage message={error} />}
    <form className="sale-layout" onSubmit={submit}>
      <div className="sale-main-column"><section className="panel sale-step-panel"><div className="sale-section-heading"><span className="step-number">01</span><div><h2>Detalle de productos</h2><p>Busca artículos con existencias disponibles.</p></div></div><div className="add-product-row"><label className="form-field grow-field">Producto<select value={productId} onChange={(event) => setProductId(event.target.value)} required><option value="" disabled>Selecciona un producto</option>{products.filter((product) => product.stock > 0).map((product) => <option value={product.id} key={product.id}>{product.name} · {product.sku} · {currency(product.price)}</option>)}</select></label><label className="form-field quantity-field">Cantidad<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><button className="button button-secondary add-item-button" type="button" onClick={addProduct}><Plus size={16} /> Agregar</button></div>
        {cart.length ? <div className="cart-list"><div className="cart-table-head"><span>ARTÍCULO</span><span>PRECIO</span><span>CANTIDAD</span><span>IMPORTE</span><span /></div>{cart.map((line) => <div className="cart-row" key={line.product.id}><div className="cart-product"><span className="cart-product-icon"><ShoppingBag size={17} /></span><div><strong>{line.product.name}</strong><small>{line.product.sku} · {line.product.stock} disponibles</small></div></div><span className="cart-unit">{currency(line.product.price)}</span><div className="quantity-control"><button type="button" onClick={() => setLineQuantity(line.product.id, line.quantity - 1)} aria-label="Reducir"><Minus size={13} /></button><span>{line.quantity}</span><button type="button" onClick={() => setLineQuantity(line.product.id, line.quantity + 1)} aria-label="Aumentar"><Plus size={13} /></button></div><strong className="cart-line-total">{currency(line.product.price * line.quantity)}</strong><button type="button" className="icon-button remove-button" onClick={() => setLineQuantity(line.product.id, 0)} aria-label="Quitar producto"><Trash2 size={16} /></button></div>)}</div> : <div className="cart-empty"><ShoppingBag size={21} /><span>Tu venta está vacía. Agrega un producto para comenzar.</span></div>}
      </section>
      <section className="panel sale-step-panel"><div className="sale-section-heading"><span className="step-number">02</span><div><h2>Datos de la operación</h2><p>Asocia la venta a un cliente y selecciona el método de pago.</p></div></div><div className="form-grid sale-data-grid"><label className="form-field">Cliente<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Venta mostrador · Sin cliente</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.document_number ? ` · ${formatCustomerDocument(customer.document_number)}` : ''}</option>)}</select></label><label className="form-field">Método de pago<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="transfer">Transferencia</option><option value="wallet">Billetera digital</option></select></label></div>{selectedCustomer && <div className="selected-customer-details contact-lines"><strong>{selectedCustomer.name}</strong><span>{selectedCustomer.document_number ? formatCustomerDocument(selectedCustomer.document_number) : 'Sin documento registrado'}</span>{selectedCustomer.email && <span>{selectedCustomer.email}</span>}{selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}{selectedCustomer.address && <span>{selectedCustomer.address}</span>}</div>}<label className="form-field span-2">Notas de seguimiento<textarea rows={3} maxLength={500} value={followUpNotes} onChange={(event) => setFollowUpNotes(event.target.value)} placeholder="Acuerdos, entrega o próxima acción con el cliente" /></label></section></div>
      <aside className="panel sale-summary-panel"><div className="summary-heading"><span className="summary-receipt-icon"><ReceiptText size={18} /></span><div><h2>Resumen</h2><p>Totales de la operación</p></div></div><div className="summary-lines"><div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div><label className="discount-line"><span>Descuento</span><span className="discount-input"><span>S/</span><input type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></span></label><div><span>IGV (18%)</span><strong>{currency(tax)}</strong></div></div><div className="summary-total"><span>Total a cobrar</span><strong>{currency(total)}</strong></div><div className="summary-payment-note"><Check size={15} /><span>El pago se registrará como completado.</span></div><button className="button button-primary complete-sale-button" disabled={saving || cart.length === 0}>{saving ? 'Registrando venta…' : <>Confirmar venta <Check size={17} /></>}</button><p className="summary-footnote">Al confirmar, se descontarán las existencias y se guardará el movimiento en el historial de inventario.</p></aside>
    </form>
  </>
}
