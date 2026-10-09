import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AnalyticsPage from './AnalyticsPage'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('../api', () => ({
  api: { get: mocks.get },
  errorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error',
}))

vi.mock('../useRealtimeRefresh', () => ({
  useRealtimeRefresh: vi.fn(),
}))

vi.mock('recharts', () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>
  const ChartPart = () => null
  return {
    Bar: ChartPart,
    BarChart: Container,
    CartesianGrid: ChartPart,
    Cell: ChartPart,
    Line: ChartPart,
    LineChart: Container,
    Pie: ChartPart,
    PieChart: Container,
    ReferenceLine: ChartPart,
    ResponsiveContainer: Container,
    Tooltip: ChartPart,
    XAxis: ChartPart,
    YAxis: ChartPart,
  }
})

const dashboard = {
  start_date: '2026-09-10',
  end_date: '2026-10-09',
  revenue: 480,
  previous_revenue: 400,
  revenue_change_percent: 20,
  sales_count: 4,
  average_ticket: 120,
  active_customers: 3,
  low_stock_products: 1,
  daily_sales: [
    { date: '2026-10-08', total: 100 },
    { date: '2026-10-09', total: 300 },
  ],
  top_products: [],
  payment_methods: [],
  sales_by_seller: [],
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    mocks.get.mockReset().mockImplementation((path: string) => Promise.resolve({
      data: path === '/analytics/dashboard' ? dashboard : [],
    }))
  })

  it('muestra Variación y desviación después de Estadística y Bayes', async () => {
    const user = userEvent.setup()
    render(<AnalyticsPage />)

    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Dashboard',
      'Estadística y Bayes',
      'Variación y desviación',
      'Insights',
      'Reportes',
    ])

    await user.click(tabs[2])
    expect(await screen.findByRole('heading', { name: 'Ingresos frente a la media' })).toBeInTheDocument()
    expect(screen.getByText('+20.0%')).toBeInTheDocument()
    expect(screen.getByText('50.0%')).toBeInTheDocument()
    expect(screen.getByText('Días con ventas')).toBeInTheDocument()
  })

  it('explica la fórmula y las variables del teorema de Bayes', async () => {
    const user = userEvent.setup()
    render(<AnalyticsPage />)

    await user.click(await screen.findByRole('tab', { name: 'Estadística y Bayes' }))

    expect(screen.getByText('P(H|E) = P(E|H) · P(H) / P(E)')).toBeInTheDocument()
    expect(screen.getByText('Hipótesis que queremos evaluar.')).toBeInTheDocument()
    expect(screen.getByText('Evidencia observada.')).toBeInTheDocument()
    expect(screen.getByText('Probabilidad previa de H, antes de observar E.')).toBeInTheDocument()
    expect(screen.getByText('Probabilidad posterior de H después de observar E.')).toBeInTheDocument()
  })
})
