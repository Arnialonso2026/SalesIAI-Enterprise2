import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaymentReceiptsPage from './PaymentReceiptsPage'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('../api', () => ({
  api: { get: mocks.get },
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error',
}))

vi.mock('../useRealtimeRefresh', () => ({
  useRealtimeRefresh: vi.fn(),
}))

const receipts = [
  {
    id: 21,
    sale_id: 30,
    sale_number: 'VTA-001',
    sale_created_at: '2026-10-01T12:00:00Z',
    document_type: 'factura' as const,
    document_number: 'F001-00000021',
    customer_name: 'Comercial Uno',
    customer_document: '20601234567',
    customer_address: 'Lima',
    customer_email: 'ventas@uno.example',
    customer_phone: '900111222',
    currency: 'PEN',
    subtotal: 100,
    discount: 5,
    tax: 17.1,
    total: 112.1,
    issued_at: '2026-10-01T12:05:00Z',
    items: [{
      id: 1,
      product_name: 'Laptop Pro',
      quantity: 1,
      unit_price: 100,
      line_total: 100,
    }],
  },
  {
    id: 22,
    sale_id: 31,
    sale_number: 'VTA-002',
    sale_created_at: '2026-10-02T12:00:00Z',
    document_type: 'boleta' as const,
    document_number: 'B001-00000022',
    customer_name: 'Servicios Dos',
    customer_document: '20123456789',
    customer_address: 'Arequipa',
    customer_email: null,
    customer_phone: null,
    currency: 'PEN',
    subtotal: 200,
    discount: 0,
    tax: 36,
    total: 236,
    issued_at: '2026-10-02T12:05:00Z',
    items: [{
      id: 2,
      product_name: 'Impresora',
      quantity: 2,
      unit_price: 100,
      line_total: 200,
    }],
  },
]

describe('PaymentReceiptsPage', () => {
  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue({ data: receipts })
  })

  it('lista boletas y facturas y muestra el detalle de la seleccionada', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><PaymentReceiptsPage /></MemoryRouter>)

    expect(await screen.findByText('Comercial Uno')).toBeInTheDocument()
    expect(screen.getAllByText('F001-00000021')).toHaveLength(2)
    expect(screen.getByText('Laptop Pro')).toBeInTheDocument()
    expect(screen.getByText('ventas@uno.example')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Detalle del comprobante F001-00000021/ })).toHaveTextContent('VTA-001')
    expect(mocks.get).toHaveBeenCalledWith('/sales/documents/payment-receipts')

    await user.click(screen.getByRole('button', { name: /B001-00000022/ }))
    expect(screen.getByRole('heading', { name: 'B001-00000022' })).toBeInTheDocument()
    expect(screen.getByText('Impresora')).toBeInTheDocument()
    expect(screen.getByText('20123456789')).toBeInTheDocument()
    expect(screen.getByText('BOLETA INTERNA')).toBeInTheDocument()
  })

  it('abre automáticamente el comprobante recién generado', async () => {
    render(<MemoryRouter initialEntries={[{
      pathname: '/comprobantes-pago',
      state: { createdDocument: 'B001-00000022' },
    }]}><PaymentReceiptsPage /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'B001-00000022' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/B001-00000022/)
    expect(screen.getByText('Impresora')).toBeInTheDocument()
  })
})
