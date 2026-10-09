import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NewSalePage from './NewSalePage'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('../api', () => ({
  api: { get: mocks.get },
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
    mocks.get.mockReset().mockImplementation((path: string) => {
      if (path === '/products') return Promise.resolve({ data: [] })
      if (path === '/customers') return Promise.resolve({ data: [customer] })
      return Promise.resolve({ data: summary })
    })
  })

  it('muestra el contacto y el resumen de compras del cliente seleccionado', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <NewSalePage />
      </MemoryRouter>,
    )

    await user.selectOptions(await screen.findByLabelText('Cliente'), '7')

    expect(await screen.findByText('Total comprado')).toBeInTheDocument()
    expect(screen.getByText('Ticket promedio')).toBeInTheDocument()
    expect(screen.getByText('Última compra', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/Empresa/)).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('Servicios profesionales')).toBeInTheDocument()
    expect(screen.getByText('Canal preferido: Correo')).toBeInTheDocument()
    expect(screen.getByText('Solicita facturación mensual')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'maria@example.com' })).toHaveAttribute('href', 'mailto:maria@example.com')
    expect(mocks.get).toHaveBeenCalledWith('/customers/7/summary')
  })
})
