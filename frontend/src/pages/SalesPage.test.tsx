import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SalesPage from './SalesPage'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('../api', () => ({
  api: { get: mocks.get },
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error',
}))

vi.mock('../App', () => ({
  useAuth: () => ({ user: { role: 'seller' } }),
}))

vi.mock('../useRealtimeRefresh', () => ({
  useRealtimeRefresh: vi.fn(),
}))

describe('SalesPage', () => {
  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue({ data: [] })
  })

  it('muestra el número de orden devuelto al registrar una venta', async () => {
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/ventas',
        state: { createdSale: 'VTA-261009123456789012' },
      }]}
      >
        <SalesPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('status')).toHaveTextContent('Venta registrada. Orden VTA-261009123456789012')
  })
})