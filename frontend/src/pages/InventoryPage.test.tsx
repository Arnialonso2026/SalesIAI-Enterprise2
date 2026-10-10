import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InventoryPage from './InventoryPage'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  products: [] as Array<Record<string, unknown>>,
  movements: [] as Array<Record<string, unknown>>,
  refresh: null as null | (() => void),
}))

vi.mock('../api', () => ({
  api: { get: mocks.get },
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error',
}))

vi.mock('../App', () => ({
  useAuth: () => ({ user: { role: 'admin' } }),
}))

vi.mock('../useRealtimeRefresh', () => ({
  useRealtimeRefresh: (callback: () => void) => { mocks.refresh = callback },
}))

function product(id: number, name: string, stock: number, minStock: number, categoryId: number, categoryName: string) {
  return {
    id,
    sku: `SKU-${id}`,
    name,
    description: null,
    category_id: categoryId,
    price: 10,
    stock,
    min_stock: minStock,
    is_active: true,
    category: { id: categoryId, name: categoryName, description: null },
  }
}

function setupProducts() {
  mocks.get.mockReset().mockImplementation((path: string) => {
    if (path === '/products') return Promise.resolve({ data: mocks.products })
    if (path === '/inventory/movements') return Promise.resolve({ data: mocks.movements })
    return Promise.resolve({ data: [] })
  })
}

describe('InventoryPage product control', () => {
  beforeEach(() => {
    mocks.products = [
      product(1, 'Laptop Pro', 4, 5, 1, 'Tecnología'),
      product(2, 'Silla ejecutiva', 14, 5, 2, 'Oficina'),
      product(3, 'Mouse portátil', 7, 5, 1, 'Tecnología'),
      product(4, 'Teclado mecánico', 0, 5, 1, 'Tecnología'),
    ]
    mocks.movements = []
    mocks.refresh = null
    setupProducts()
  })

  it('filtra productos por texto, categoría y nivel de existencias', async () => {
    const user = userEvent.setup()
    render(<InventoryPage />)
    await user.click(await screen.findByRole('tab', { name: /control de productos/i }))

    const layout = await screen.findByRole('article', { name: 'Laptop Pro: Crítico' })
    expect(layout.parentElement).toHaveClass('inventory-stock-card-grid')
    expect(layout.parentElement?.parentElement?.lastElementChild).toHaveClass('inventory-tracking-side')
    expect(screen.getByRole('article', { name: 'Mouse portátil: En seguimiento' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Teclado mecánico: Agotado' })).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar producto por nombre o SKU' }), 'silla')
    await user.selectOptions(screen.getByLabelText('Filtrar por categoría'), '2')
    await user.selectOptions(screen.getByLabelText('Filtrar por estado del stock'), 'healthy')

    expect(screen.getByText('Silla ejecutiva')).toBeInTheDocument()
    expect(screen.queryByText('Laptop Pro')).not.toBeInTheDocument()
  })

  it('actualiza barras y estado cuando llegan existencias nuevas', async () => {
    const user = userEvent.setup()
    render(<InventoryPage />)
    await user.click(await screen.findByRole('tab', { name: /control de productos/i }))

    const initialMeter = await screen.findByRole('meter', { name: 'Nivel de stock de Laptop Pro' })
    expect(initialMeter).toHaveAttribute('aria-valuenow', '4')
    expect(screen.getByRole('article', { name: 'Laptop Pro: Crítico' })).toBeInTheDocument()

    mocks.products = [product(1, 'Laptop Pro', 8, 5, 1, 'Tecnología')]
    act(() => mocks.refresh?.())

    await waitFor(() => expect(screen.getByRole('article', { name: 'Laptop Pro: En seguimiento' })).toBeInTheDocument())
    expect(screen.getByRole('meter', { name: 'Nivel de stock de Laptop Pro' })).toHaveAttribute('aria-valuenow', '8')

    mocks.products = [product(1, 'Laptop Pro', 0, 5, 1, 'Tecnología')]
    act(() => mocks.refresh?.())

    await waitFor(() => expect(screen.getByRole('article', { name: 'Laptop Pro: Agotado' })).toBeInTheDocument())
    expect(screen.getByRole('meter', { name: 'Nivel de stock de Laptop Pro' })).toHaveAttribute('aria-valuenow', '0')
  })

  it('abre todos los movimientos recientes y permite filtrarlos por tipo', async () => {
    mocks.movements = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      product_id: 1,
      sale_id: index === 0 ? 44 : null,
      purchase_id: null,
      movement_type: index === 0 ? 'sale' : 'entry',
      quantity: index === 0 ? -1 : 1,
      stock_after: 10 - index,
      note: `Movimiento ${index + 1}`,
      created_at: '2026-10-09T12:00:00Z',
    }))
    const user = userEvent.setup()
    render(<InventoryPage />)

    await user.click(await screen.findByRole('tab', { name: /control de productos/i }))
    await user.click(await screen.findByRole('button', { name: /ver todos los movimientos/i }))

    expect(await screen.findByText('10 de 10 movimientos')).toBeInTheDocument()
    expect(document.querySelectorAll('.movement-row')).toHaveLength(10)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar tipo de movimiento' }), 'sale')

    expect(screen.getByText('1 de 10 movimientos')).toBeInTheDocument()
    expect(screen.getByText(/Movimiento 1/)).toBeInTheDocument()
    expect(screen.queryByText(/Movimiento 2/)).not.toBeInTheDocument()
  })

  it('permite cargar páginas anteriores del historial de movimientos', async () => {
    const allMovements = Array.from({ length: 105 }, (_, index) => ({
      id: index + 1,
      product_id: 1,
      sale_id: null,
      purchase_id: null,
      movement_type: 'entry',
      quantity: 1,
      stock_after: index + 1,
      note: `Movimiento ${index + 1}`,
      created_at: '2026-10-09T12:00:00Z',
    }))
    mocks.get.mockImplementation((path: string, config?: { params?: { offset?: number; limit?: number } }) => {
      if (path === '/products') return Promise.resolve({ data: mocks.products })
      if (path === '/inventory/movements') {
        const offset = config?.params?.offset ?? 0
        const limit = config?.params?.limit ?? 100
        return Promise.resolve({ data: allMovements.slice(offset, offset + limit) })
      }
      return Promise.resolve({ data: [] })
    })
    const user = userEvent.setup()
    render(<InventoryPage />)

    await user.click(await screen.findByRole('tab', { name: /control de productos/i }))
    await user.click(await screen.findByRole('button', { name: /ver todos los movimientos/i }))

    expect(await screen.findByText('100 de 100 movimientos')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cargar movimientos anteriores' }))
    expect(await screen.findByText(/Movimiento 105/)).toBeInTheDocument()
    expect(screen.getByText('105 de 105 movimientos')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cargar movimientos anteriores' })).not.toBeInTheDocument()
  })
})
