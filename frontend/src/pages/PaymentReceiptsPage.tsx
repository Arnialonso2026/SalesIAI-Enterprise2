import { useEffect, useMemo, useState } from 'react'
import { FileText, Search } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback'
import PageHeader from '../components/PageHeader'
import type { PaymentReceipt } from '../types'
import { currency, dateTime } from '../utils'
import { useRealtimeRefresh } from '../useRealtimeRefresh'
import './invoices.css'

type ReceiptLocationState = { createdDocument?: string } | null

export default function PaymentReceiptsPage() {
  const location = useLocation()
  const createdDocument = (location.state as ReceiptLocationState)?.createdDocument
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([])
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadReceipts() {
    try {
      const { data } = await api.get<PaymentReceipt[]>('/sales/documents/payment-receipts')
      setReceipts(data)
      setSelectedReceiptId((currentId) => {
        const created = createdDocument
          ? data.find((receipt) => receipt.document_number === createdDocument)
          : undefined
        return created?.id ?? data.find((receipt) => receipt.id === currentId)?.id ?? data[0]?.id ?? null
      })
      setError('')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadReceipts() }, [])
  useRealtimeRefresh(() => loadReceipts())

  const filteredReceipts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    if (!term) return receipts
    return receipts.filter((receipt) => [
      receipt.document_number,
      receipt.customer_name,
      receipt.customer_document,
      receipt.sale_number,
    ].some((value) => value?.toLocaleLowerCase().includes(term)))
  }, [receipts, search])
  const selectedReceipt = filteredReceipts.find((receipt) => receipt.id === selectedReceiptId) ?? null
  const totalIssued = receipts.reduce((sum, receipt) => sum + receipt.total, 0)

  return <>
    <PageHeader
      eyebrow="DOCUMENTOS DE VENTA"
      title="Comprobantes de pago"
      description="Consulta las boletas y facturas emitidas y revisa el detalle de cada operación."
    />
    {createdDocument && <div className="server-toast" role="status" aria-live="polite">
      Comprobante {createdDocument} generado y listo para consultar.
    </div>}
    {error && <ErrorMessage message={error} />}
    <div className="invoice-summary-row">
      <div className="invoice-summary-card">
        <span className="invoice-summary-icon"><FileText size={18} /></span>
        <div><small>Comprobantes emitidos</small><strong>{receipts.length}</strong></div>
      </div>
      <div className="invoice-summary-card">
        <span className="invoice-summary-icon invoice-summary-icon-green">S/</span>
        <div><small>Importe total</small><strong>{currency(totalIssued)}</strong></div>
      </div>
      <label className="invoice-search">
        <Search size={16} />
        <input
          aria-label="Buscar comprobantes"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="N.º de comprobante, cliente o DNI/RUC…"
        />
      </label>
    </div>
    {loading ? <Loading /> : receipts.length === 0 ? (
      <EmptyState title="Aún no hay comprobantes" description="Los comprobantes aparecerán aquí cuando confirmes una venta." />
    ) : filteredReceipts.length === 0 ? (
      <EmptyState title="No se encontraron comprobantes" description="Prueba con otro número, cliente o documento." />
    ) : <div className="invoice-workspace">
      <section className="panel invoice-list-panel" aria-label="Listado de comprobantes">
        <div className="invoice-list-heading">
          <div><strong>Todos los comprobantes</strong><span>{filteredReceipts.length} documento{filteredReceipts.length === 1 ? '' : 's'}</span></div>
        </div>
        <div className="invoice-list">
          {filteredReceipts.map((receipt) => (
            <button
              type="button"
              className={`invoice-list-item${selectedReceipt?.id === receipt.id ? ' selected' : ''}`}
              key={receipt.id}
              onClick={() => setSelectedReceiptId(receipt.id)}
              aria-pressed={selectedReceipt?.id === receipt.id}
            >
              <span className="invoice-list-item-icon"><FileText size={17} /></span>
              <span className="invoice-list-item-main">
                <strong>{receipt.document_number}</strong>
                <small>{receipt.document_type === 'factura' ? 'Factura' : 'Boleta'} · {receipt.customer_name}</small>
                <small>{dateTime(receipt.issued_at)}</small>
              </span>
              <strong className="invoice-list-total">{currency(receipt.total)}</strong>
            </button>
          ))}
        </div>
      </section>
      {selectedReceipt && <section className="panel invoice-detail-panel" aria-label={`Detalle del comprobante ${selectedReceipt.document_number}`}>
        <header className="invoice-detail-header">
          <div>
            <span className="invoice-type-label">{selectedReceipt.document_type === 'factura' ? 'FACTURA INTERNA' : 'BOLETA INTERNA'}</span>
            <h2>{selectedReceipt.document_number}</h2>
            <p>Emitido {dateTime(selectedReceipt.issued_at)} · Orden {selectedReceipt.sale_number}</p>
          </div>
          <span className="invoice-status">Emitido</span>
        </header>
        <div className="invoice-detail-content">
          <div className="invoice-items-section">
            <div className="invoice-section-heading">
              <div><strong>Detalle del comprobante</strong><span>{selectedReceipt.items.length} artículo{selectedReceipt.items.length === 1 ? '' : 's'} registrado{selectedReceipt.items.length === 1 ? '' : 's'} en la orden original.</span></div>
            </div>
            <div className="invoice-items-scroll">
              <table className="invoice-items-table">
                <thead><tr><th>Producto</th><th>Cant.</th><th>Precio unit.</th><th>Importe</th></tr></thead>
                <tbody>{selectedReceipt.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td>{item.quantity}</td>
                    <td>{currency(item.unit_price)}</td>
                    <td>{currency(item.line_total)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <aside className="invoice-customer-card">
            <div className="invoice-section-heading"><div><strong>Datos del cliente</strong><span>Datos guardados al emitir el comprobante</span></div></div>
            <dl className="invoice-customer-details">
              <div><dt>{selectedReceipt.document_type === 'factura' ? 'Razón social' : 'Cliente'}</dt><dd>{selectedReceipt.customer_name}</dd></div>
              <div><dt>{selectedReceipt.document_type === 'factura' ? 'RUC' : 'DNI / RUC'}</dt><dd>{selectedReceipt.customer_document || 'No registrado'}</dd></div>
              <div><dt>Dirección</dt><dd>{selectedReceipt.customer_address || 'No registrada'}</dd></div>
              <div><dt>Correo</dt><dd>{selectedReceipt.customer_email || 'No registrado'}</dd></div>
              <div><dt>Teléfono</dt><dd>{selectedReceipt.customer_phone || 'No registrado'}</dd></div>
              <div><dt>Fecha de venta</dt><dd>{dateTime(selectedReceipt.sale_created_at)}</dd></div>
            </dl>
            <div className="invoice-totals">
              <div><span>Subtotal</span><strong>{currency(selectedReceipt.subtotal)}</strong></div>
              <div><span>Descuento</span><strong>- {currency(selectedReceipt.discount)}</strong></div>
              <div><span>IGV</span><strong>{currency(selectedReceipt.tax)}</strong></div>
              <div className="invoice-grand-total"><span>Total</span><strong>{currency(selectedReceipt.total)}</strong></div>
            </div>
          </aside>
        </div>
        <p className="invoice-disclaimer">Documento interno de demostración; no es un comprobante tributario ni está integrado con SUNAT.</p>
      </section>}
    </div>}
  </>
}
