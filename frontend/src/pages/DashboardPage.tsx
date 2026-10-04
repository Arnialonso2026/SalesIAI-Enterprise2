import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CircleDollarSign, Package, Plus, ShoppingBag, Users } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, errorMessage } from '../api'
import { ErrorMessage, Loading } from '../components/Feedback'
import PageHeader from '../components/PageHeader'
import type { DashboardSummary } from '../types'
import { currency, dateShort, dateTime } from '../utils'

const emptySummary: DashboardSummary = {
  total_revenue: 0, month_revenue: 0, today_sales: 0, sales_count: 0, customers_count: 0,
  low_stock_count: 0, daily_sales: [], recent_sales: [],
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<DashboardSummary>('/dashboard/summary')
      .then(({ data }) => setSummary(data))
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoading(false))
  }, [])

  const chartData = summary.daily_sales.map((item) => ({ ...item, label: dateShort(item.date) }))
  const metrics = [
    { label: 'Ingresos del mes', value: currency(summary.month_revenue), detail: 'Ventas registradas este mes', icon: CircleDollarSign, tone: 'blue', trend: 'Actividad comercial' },
    { label: 'Ventas de hoy', value: String(summary.today_sales), detail: 'Operaciones completadas', icon: ShoppingBag, tone: 'cyan', trend: 'En tiempo real' },
    { label: 'Clientes activos', value: String(summary.customers_count), detail: 'En tu cartera comercial', icon: Users, tone: 'violet', trend: 'Base de clientes' },
    { label: 'Stock por revisar', value: String(summary.low_stock_count), detail: 'Productos en nivel mínimo', icon: Package, tone: 'amber', trend: summary.low_stock_count ? 'Requiere atención' : 'Todo en orden' },
  ]

  return <>
    <PageHeader eyebrow="PANEL DE CONTROL" title="Resumen ejecutivo" description="Así se mueve tu operación comercial. Aquí tienes lo más importante de hoy." action={<Link className="button button-primary" to="/ventas/nueva"><Plus size={17} /> Registrar venta</Link>} />
    {error && <ErrorMessage message={error} />}
    {loading ? <Loading label="Preparando tu resumen…" /> : <>
      <div className="welcome-banner"><div className="welcome-copy"><div className="welcome-kicker"><Activity size={15} /> TU NEGOCIO, EN PERSPECTIVA</div><h2>Los datos de hoy impulsan las decisiones de mañana.</h2><p>Has registrado <strong>{summary.sales_count} ventas</strong> y generado <strong>{currency(summary.total_revenue)}</strong> en ingresos acumulados.</p></div><div className="welcome-decoration"><div className="decoration-ring ring-a" /><div className="decoration-ring ring-b" /><div className="decoration-bars"><i /><i /><i /><i /><i /><i /><i /></div></div></div>
      <div className="metric-grid">{metrics.map(({ label, value, detail, icon: Icon, tone, trend }, index) => <article className="metric-card" key={label}><div className="metric-top"><span>{label}</span><div className={`metric-icon ${tone}`}><Icon size={19} /></div></div><div className="metric-value">{value}</div><div className="metric-bottom"><span className="metric-detail">{detail}</span><span className={`metric-trend ${index === 3 && summary.low_stock_count ? 'warning-text' : ''}`}>{index === 3 && summary.low_stock_count ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}{trend}</span></div></article>)}</div>
      <div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">RENDIMIENTO</span><h2>Ventas en los últimos días</h2><p>Ingresos por día en soles peruanos</p></div><span className="period-chip"><span /> Últimos 7 días</span></div>{chartData.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 15, right: 12, bottom: 0, left: 0 }}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edf0f5" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8a93a5', fontSize: 12 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8a93a5', fontSize: 11 }} tickFormatter={(value: number) => `S/${value}`} width={55} /><Tooltip formatter={(value) => [currency(Number(value)), 'Ventas']} contentStyle={{ border: '1px solid #edf0f5', borderRadius: 12, boxShadow: '0 8px 24px #162a4d12' }} /><Line type="monotone" dataKey="total" stroke="#2269e8" strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: '#2269e8', strokeWidth: 2 }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div> : <div className="chart-empty"><div className="chart-empty-icon"><Activity size={23} /></div><strong>Tu actividad aparecerá aquí</strong><span>Registra ventas para visualizar la evolución de tus ingresos.</span></div>}</section>
      <section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">ACTIVIDAD RECIENTE</span><h2>Últimas ventas</h2><p>Movimientos registrados recientemente</p></div><Link className="text-link" to="/ventas">Ver todas <ArrowRight size={15} /></Link></div><div className="activity-list">{summary.recent_sales.length ? summary.recent_sales.map((sale, index) => <div className="activity-item" key={sale.id}><span className={`activity-icon activity-${index % 4}`}><ShoppingBag size={16} /></span><div className="activity-main"><strong>{sale.sale_number}</strong><small>{dateTime(sale.created_at)}</small></div><div className="activity-amount"><strong>{currency(sale.total)}</strong><small className="status-pill status-completed">Completada</small></div></div>) : <div className="activity-empty">Aún no hay ventas para mostrar.</div>}</div></section></div>
      <div className="bottom-note"><div className="note-icon"><Activity size={18} /></div><div><strong>Tu próxima oportunidad empieza aquí</strong><span>Registra una venta y mantén tus indicadores comerciales al día.</span></div><Link to="/ventas/nueva" aria-label="Crear una venta"><ArrowRight size={18} /></Link></div>
    </>}
  </>
}
