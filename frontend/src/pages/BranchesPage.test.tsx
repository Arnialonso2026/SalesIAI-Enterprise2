import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BranchesPage from './BranchesPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('../api', () => ({
  api: { get: mocks.get, post: mocks.post },
  errorMessage: () => 'Error de API',
}))

vi.mock('../useRealtimeRefresh', () => ({
  useRealtimeRefresh: vi.fn(),
}))

describe('BranchesPage', () => {
  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue({
      data: [{
        id: 1,
        company_id: 1,
        name: 'Lima Centro',
        address: 'Lima, Perú',
        latitude: -12.0464,
        longitude: -77.0428,
        is_active: true,
        created_at: '2026-10-09T12:00:00Z',
      }],
    })
    mocks.post.mockReset().mockResolvedValue({ data: {} })
  })

  it('ubica las sucursales activas y permite registrar una nueva', async () => {
    const user = userEvent.setup()
    render(<BranchesPage />)

    expect(await screen.findByRole('button', { name: 'Sucursal Lima Centro' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nueva sucursal' }))
    await user.type(screen.getByLabelText('Nombre'), 'Cusco')
    await user.type(screen.getByLabelText('Dirección'), 'Cusco, Perú')
    await user.type(screen.getByLabelText('Latitud'), '-13.5319')
    await user.type(screen.getByLabelText('Longitud'), '-71.9675')
    await user.click(screen.getByRole('button', { name: 'Crear sucursal' }))

    expect(mocks.post).toHaveBeenCalledWith('/branches', {
      name: 'Cusco',
      address: 'Cusco, Perú',
      latitude: -13.5319,
      longitude: -71.9675,
    })
  })
})
