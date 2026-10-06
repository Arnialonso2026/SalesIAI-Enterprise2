import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import LandingPage from './LandingPage'

describe('LandingPage', () => {
  it('muestra la presentación y enlaza con el login', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: /tu operación/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /iniciar sesión/i })).toHaveLength(3)
    screen.getAllByRole('link', { name: /iniciar sesión/i }).forEach(link => expect(link).toHaveAttribute('href', '/login'))
    expect(screen.getByRole('heading', { name: /funciones que hacen crecer/i })).toBeInTheDocument()
  })
})
