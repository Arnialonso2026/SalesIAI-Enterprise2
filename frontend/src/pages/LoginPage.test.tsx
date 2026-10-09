import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'

const mocks = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockPost: vi.fn(),
}))

vi.mock('../api', () => ({
  api: {
    post: mocks.mockPost,
  },
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error',
}))

vi.mock('../App', () => ({
  useAuth: () => ({ signIn: mocks.mockSignIn }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    mocks.mockSignIn.mockReset()
    mocks.mockPost.mockReset()
  })

  it('envía DNI y contraseña al iniciar sesión', async () => {
    mocks.mockPost.mockResolvedValue({
      data: {
        access_token: 'demo-token',
        user: { id: 1, full_name: 'Ana López', email: 'ana@demo.com', dni: '12345678', role: 'admin', company_id: 1, is_active: true, password_configured: true },
      },
    })

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/dni/i), '12345678')
    await user.type(screen.getByLabelText(/contraseña/i), 'Password2026!')
    expect(screen.queryByRole('button', { name: 'Acceso temporal de administrador' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /entrar a mi espacio/i }))

    expect(screen.queryByText(/SalesIA2026!/i)).not.toBeInTheDocument()
    expect(mocks.mockPost).toHaveBeenCalledWith('/auth/login', {
      dni: '12345678',
      password: 'Password2026!',
    })
    expect(mocks.mockSignIn).toHaveBeenCalledWith('demo-token', expect.objectContaining({ dni: '12345678' }))
  })

  it('muestra el error de autenticación sin iniciar sesión', async () => {
    mocks.mockPost.mockRejectedValue(new Error('DNI o contraseña incorrectos.'))

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/dni/i), '12345678')
    await user.type(screen.getByLabelText(/contraseña/i), 'incorrecta')
    await user.click(screen.getByRole('button', { name: /entrar a mi espacio/i }))

    expect(await screen.findByText('DNI o contraseña incorrectos.')).toBeInTheDocument()
    expect(mocks.mockSignIn).not.toHaveBeenCalled()
  })

})
