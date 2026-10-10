import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NewSalePage from './NewSalePage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('../api', () => ({
  api: { get: mocks.get, post: mocks.post },
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error',
}))

vi.mock('../useRealtimeRefresh', () => ({
  useRealtimeRefresh: vi.fn(),
}))

const customer = {
  id: 7,
  name: 'María Fernández',
  email: 'maria@example.com',
  phone: '+51 987 654 321',
  document_number: '45892316',
  address: 'Lima, Perú',
  customer_type: 'business',
  contact_name: 'Ana Pérez',
  industry: 'Servicios profesionales',
  preferred_contact_method: 'email',
  notes: 'Solicita facturación mensual',
  is_active: true,
  created_at: '2025-01-15T12:00:00Z',
}

const summary = {
  customer_id: 7,
  sales_count: 3,
  total_spent: 480,
  average_ticket: 160,
  last_purchase_at: '2026-10-01T12:00:00Z',
}

describe('NewSalePage', () => {
  beforeEach(() => {
    mocks.post.mockReset().mockResolvedValue({ data: { sale_number: 'VTA-TEST' } })
    mocks.get.mockReset().mockImplementation((path: string) => {
      if (path === '/products') return Promise.resolve({ data: [] })
      if (path === '/customers') return Promise.resolve({ data: [customer] })
      return Promise.resolve({ data: summary })
    })
  })

  it('carga los datos del cliente en el formulario editable sin guardar sus cambios', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <NewSalePage />
      </MemoryRouter>,
    )

    await user.selectOptions(await screen.findByLabelText('Cliente'), '7')

    expect(await screen.findByText('Total comprado')).toBeInTheDocument()
    expect(screen.getByText('Ticket promedio')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre o razón social')).toHaveValue('María Fernández')
    expect(screen.getByLabelText('Correo del cliente')).toHaveValue('maria@example.com')
    expect(screen.getByLabelText('Dirección del cliente')).toHaveValue('Lima, Perú')
    expect(screen.getByLabelText('Tipo de comprobante')).toHaveValue('boleta')
    expect(mocks.get).toHaveBeenCalledWith('/customers/7/summary')
  })

  it('presenta el detalle de productos a la izquierda y los datos del cliente a la derecha', async () => {
    render(<MemoryRouter><NewSalePage /></MemoryRouter>)

    expect(await screen.findByRole('region', { name: 'Detalle de productos' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Datos del cliente y operación' })).toBeInTheDocument()
    expect(screen.getByLabelText('Resumen de la orden de venta')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Detalle de productos' }).compareDocumentPosition(
      screen.getByRole('region', { name: 'Datos del cliente y operación' }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Orden de venta' })).toBeInTheDocument()
  })

  it('registra el abono inicial cuando se elige un pago parcial', async () => {
    mocks.get.mockImplementation((path: string) => {
      if (path === '/products') return Promise.resolve({ data: [{
        id: 12,
        name: 'Producto de prueba',
        sku: 'TEST-12',
        price: 100,
        stock: 5,
        min_stock: 1,
        description: null,
        category_id: null,
        category: null,
        is_active: true,
      }] })
      if (path === '/customers') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: summary })
    })
    const user = userEvent.setup()
    render(<MemoryRouter><NewSalePage /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: /buscar producto por código o descripción/i }))
    await user.click(await screen.findByRole('button', { name: 'Agregar Producto de prueba' }))
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    await user.selectOptions(screen.getByLabelText('Tipo de pago'), 'partial')
    await user.type(screen.getByLabelText('Abono inicial'), '50')
    await user.click(screen.getByRole('button', { name: /revisar comprobante/i }))
    expect(mocks.post).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Comprobante de pago' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /confirmar venta y generar comprobante/i }))

    expect(mocks.post).toHaveBeenCalledWith('/sales', expect.objectContaining({
      payment_amount: 50,
      payment_method: 'cash',
    }))
  })

  it('filtra productos y genera una factura con el cliente editado solo en esta venta', async () => {
    mocks.get.mockImplementation((path: string) => {
      if (path === '/products') return Promise.resolve({ data: [{
        id: 12,
        name: 'Laptop Pro',
        sku: 'LAP-12',
        price: 100,
        stock: 5,
        min_stock: 1,
        description: null,
        category_id: null,
        category: { id: 1, name: 'Tecnología', description: null },
        is_active: true,
      }, {
        id: 13,
        name: 'Mouse USB',
        sku: 'MOU-13',
        price: 25,
        stock: 8,
        min_stock: 1,
        description: null,
        category_id: null,
        category: null,
        is_active: true,
      }] })
      if (path === '/customers') return Promise.resolve({ data: [customer] })
      return Promise.resolve({ data: summary })
    })
    mocks.post.mockResolvedValue({ data: {
      sale_number: 'VTA-TEST',
      document: { document_number: 'F001-00000001' },
    } })
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/ventas/nueva']}><Routes>
      <Route path="/ventas/nueva" element={<NewSalePage />} />
      <Route path="/comprobantes-pago" element={<h1>Comprobantes del sistema</h1>} />
    </Routes></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: /buscar producto por código o descripción/i }))
    await user.type(await screen.findByLabelText('Buscar por código o descripción'), 'LAP-12')
    expect(screen.queryByRole('button', { name: 'Agregar Mouse USB' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Agregar Laptop Pro' }))
    expect(screen.getByRole('dialog', { name: 'Seleccionar producto' })).toBeInTheDocument()
    expect(screen.getByText('LAP-12 · 5 disponibles')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    await user.selectOptions(await screen.findByLabelText('Cliente'), '7')
    await user.clear(screen.getByLabelText('Nombre o razón social'))
    await user.type(screen.getByLabelText('Nombre o razón social'), 'Empresa temporal')
    await user.clear(screen.getByLabelText('RUC'))
    await user.type(screen.getByLabelText('RUC'), '20601234567')
    await user.clear(screen.getByLabelText('Dirección del cliente'))
    await user.type(screen.getByLabelText('Dirección del cliente'), 'Dirección para esta venta')
    await user.selectOptions(screen.getByLabelText('Tipo de comprobante'), 'factura')
    await user.click(screen.getByRole('button', { name: /revisar comprobante/i }))
    expect(mocks.post).not.toHaveBeenCalled()
    await user.clear(screen.getByLabelText('Nombre en comprobante'))
    await user.type(screen.getByLabelText('Nombre en comprobante'), 'Razón social corregida')
    await user.click(screen.getByRole('button', { name: /confirmar venta y generar comprobante/i }))

    expect(mocks.post).toHaveBeenCalledWith('/sales', expect.objectContaining({
      document_type: 'factura',
      document_customer: expect.objectContaining({
        name: 'Razón social corregida',
        document_number: '20601234567',
        address: 'Dirección para esta venta',
      }),
    }))
    expect(mocks.get).not.toHaveBeenCalledWith('/customers/7', expect.anything())
    expect(await screen.findByRole('heading', { name: 'Comprobantes del sistema' })).toBeInTheDocument()
  })
})
