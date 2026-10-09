import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomersPage from './CustomersPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('../api', () => ({
  api: { get: mocks.get, post: mocks.post },
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error',
}))

vi.mock('../App', () => ({
  useAuth: () => ({ user: { role: 'admin' } }),
}))

vi.mock('../useRealtimeRefresh', () => ({
  useRealtimeRefresh: vi.fn(),
}))

describe('CustomersPage', () => {
  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue({ data: [] })
    mocks.post.mockReset().mockResolvedValue({ data: {} })
  })

  it('envía el perfil comercial al crear un cliente', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <CustomersPage />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: 'Nuevo cliente' }))
    await user.type(screen.getByLabelText('Nombre o razón social'), 'Empresa Nueva')
    await user.selectOptions(screen.getByLabelText('Tipo de cliente'), 'business')
    await user.type(screen.getByLabelText('Persona de contacto'), 'Ana Pérez')
    await user.type(screen.getByLabelText('Sector o actividad'), 'Tecnología')
    await user.selectOptions(screen.getByLabelText('Canal preferido'), 'email')
    await user.type(screen.getByLabelText('Notas comerciales'), 'Prefiere facturación mensual')
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }))

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/customers', expect.objectContaining({
      name: 'Empresa Nueva',
      customer_type: 'business',
      contact_name: 'Ana Pérez',
      industry: 'Tecnología',
      preferred_contact_method: 'email',
      notes: 'Prefiere facturación mensual',
      email: null,
      phone: null,
      document_number: null,
      address: null,
    })))
  })
})
