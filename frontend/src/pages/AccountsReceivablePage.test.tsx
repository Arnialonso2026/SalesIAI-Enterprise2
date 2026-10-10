import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccountsReceivablePage from './AccountsReceivablePage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('../api', () => ({
  api: { get: mocks.get, post: mocks.post },
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error',
}))

vi.mock('../App', () => ({
  useAuth: () => ({ user: { role: 'seller' } }),
}))

vi.mock('../useRealtimeRefresh', () => ({
  useRealtimeRefresh: vi.fn(),
}))

const receivable = {
  paid_amount: 50,
  balance: 68,
  sale: {
    id: 21,
    sale_number: 'VTA-TEST-21',
    created_by_id: 1,
    created_by: { id: 1, full_name: 'Vendedor Prueba', role: 'seller' },
    customer_id: 7,
    customer: { id: 7, name: 'Cliente Prueba' },
    status: 'completed',
    subtotal: 100,
    discount: 0,
    tax: 18,
    total: 118,
    notes: null,
    created_at: '2026-10-09T12:00:00Z',
    items: [],
    payments: [{ id: 1, amount: 50, method: 'cash', status: 'paid', paid_at: '2026-10-09T12:00:00Z' }],
    document: null,
  },
}

describe('AccountsReceivablePage', () => {
  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue({ data: [receivable] })
    mocks.post.mockReset().mockResolvedValue({ data: receivable.sale })
  })

  it('muestra el saldo pendiente y permite registrar un abono', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AccountsReceivablePage /></MemoryRouter>)

    expect(await screen.findByText('VTA-TEST-21')).toBeInTheDocument()
    expect(screen.getAllByText(/68\.00/)).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Registrar abono' }))
    fireEvent.change(screen.getByLabelText('Importe del abono'), { target: { value: '25' } })
    await user.click(screen.getByRole('button', { name: 'Guardar abono' }))

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/sales/21/payments', {
      amount: 25,
      method: 'cash',
    }))
    expect(mocks.get).toHaveBeenCalledWith('/sales/accounts-receivable', {
      params: { limit: 100, offset: 0 },
    })
  })

  it('muestra el historial con estado de pago calculado desde los abonos', async () => {
    const fullPayment = {
      ...receivable,
      paid_amount: 118,
      balance: 0,
      sale: {
        ...receivable.sale,
        id: 22,
        sale_number: 'VTA-PAGADA',
        payments: [{ id: 1, amount: 118, method: 'cash', status: 'paid', paid_at: '2026-10-09T12:00:00Z' }],
      },
    }
    const noPayment = {
      ...receivable,
      paid_amount: 0,
      balance: 118,
      sale: { ...receivable.sale, id: 23, sale_number: 'VTA-PENDIENTE', payments: [] },
    }
    mocks.get.mockImplementation((path: string) => Promise.resolve({
      data: path === '/sales/history' ? [receivable, fullPayment, noPayment] : [receivable],
    }))
    const user = userEvent.setup()
    render(<MemoryRouter><AccountsReceivablePage /></MemoryRouter>)

    await user.click(await screen.findByRole('tab', { name: /Historial de ventas/ }))
    expect(await screen.findByText('VTA-TEST-21')).toBeInTheDocument()
    expect(screen.getAllByText('Pago parcial')).toHaveLength(2)
    expect(screen.getByText('VTA-PAGADA')).toBeInTheDocument()
    expect(screen.getAllByText('Pagada')).toHaveLength(2)
    expect(screen.getByText('VTA-PENDIENTE')).toBeInTheDocument()
    expect(screen.getAllByText('Pendiente de pago')).toHaveLength(2)
    expect(screen.queryByText('Completada')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filtrar por estado de pago'), 'partial')
    expect(screen.getByText('VTA-TEST-21')).toBeInTheDocument()
    expect(screen.queryByText('VTA-PAGADA')).not.toBeInTheDocument()
    expect(screen.queryByText('VTA-PENDIENTE')).not.toBeInTheDocument()
  })
})
