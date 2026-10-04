import { useEffect, useState, type FormEvent } from 'react'
import { Activity, BarChart3, Check, Download, FileSpreadsheet, FlaskConical, Lightbulb, LoaderCircle, Sigma, Sparkles, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, errorMessage } from '../api'
import { ErrorMessage, Loading } from '../components/Feedback'
import PageHeader from '../components/PageHeader'
import type { AnalyticsDashboard, AnalyticsReport, BayesianAnalysis, Insight, StatisticalAnalysis, StatisticalCalculation } from '../types'
import { currency, dateShort, dateTime } from '../utils'
import './analytics.css'
import { useRealtimeRefresh } from '../useRealtimeRefresh'

type AnalyticsTab = 'dashboard' | 'statistics' | 'insights' | 'reports'

const tabs: { id: AnalyticsTab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'statistics', label: 'Estadística y Bayes', icon: Sigma },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'reports', label: 'Reportes', icon: FileSpreadsheet },
]

const palette = ['#2572d8', '#23a789', '#e29a3b', '#8871ce', '#db6870']

function localDate(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 10)
}

function initialDates() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 29)
  return { start_date: localDate(start), end_date: localDate(end) }
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<AnalyticsTab>('dashboard')
  const [dates, setDates] = useState(initialDates)
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [statistics, setStatistics] = useState<StatisticalAnalysis[]>([])
  const [bayesianHistory, setBayesianHistory] = useState<BayesianAnalysis[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [reports, setReports] = useState<AnalyticsReport[]>([])
  const [calculation, setCalculation] = useState<StatisticalCalculation | null>(null)
  const [bayesianResult, setBayesianResult] = useState<{ posterior_probability: number; evidence_probability: number } | null>(null)
  const [analysisName, setAnalysisName] = useState('Análisis de ventas')
  const [variableName, setVariableName] = useState('Ingresos')
  const [valuesText, setValuesText] = useState('120, 150, 180, 210, 240, 240, 300')
  const [threshold, setThreshold] = useState('200')
  const [bayesName, setBayesName] = useState('Conversión de campaña')
  const [question, setQuestion] = useState('¿La campaña generó una compra?')
  const [prior, setPrior] = useState('0.25')
  const [likelihoodTrue, setLikelihoodTrue] = useState('0.8')
  const [likelihoodFalse, setLikelihoodFalse] = useState('0.2')
  const [reportFormat, setReportFormat] = useState<'csv' | 'json'>('csv')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)

  useRealtimeRefresh(() => setRefreshVersion((version) => version + 1))

  useEffect(() => {
    let active = true
    setDashboardLoading(true)
    api.get<AnalyticsDashboard>('/analytics/dashboard', { params: dates })
      .then(({ data }) => { if (active) setDashboard(data) })
      .catch((cause: unknown) => { if (active) setError(errorMessage(cause)) })
      .finally(() => { if (active) setDashboardLoading(false) })
    return () => { active = false }
  }, [dates, refreshVersion])

  useEffect(() => {
    let active = true
    Promise.all([
      api.get<StatisticalAnalysis[]>('/analytics/statistics'),
      api.get<BayesianAnalysis[]>('/analytics/bayes'),
      api.get<Insight[]>('/analytics/insights'),
      api.get<AnalyticsReport[]>('/analytics/reports'),
    ]).then(([statisticsResponse, bayesResponse, insightResponse, reportResponse]) => {
      if (!active) return
      setStatistics(statisticsResponse.data)
      setBayesianHistory(bayesResponse.data)
      setInsights(insightResponse.data)
      setReports(reportResponse.data)
    }).catch((cause: unknown) => { if (active) setError(errorMessage(cause)) })
    return () => { active = false }
  }, [refreshVersion])

  async function submitStatistics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = valuesText.split(/[\s,;]+/).filter(Boolean).map(Number)
    if (!values.length || values.some((value) => !Number.isFinite(value))) {
      setError('Ingresa una lista de números separados por coma o espacio.')
      return
    }
    setBusy('statistics')
    setError('')
    try {
      const { data } = await api.post<StatisticalCalculation>('/analytics/statistics', {
        name: analysisName,
        variable_name: variableName,
        values,
        threshold: threshold.trim() ? Number(threshold) : null,
      })
      setCalculation(data)
      const history = await api.get<StatisticalAnalysis[]>('/analytics/statistics')
      setStatistics(history.data)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy('')
    }
  }

  async function submitBayes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('bayes')
    setError('')
    try {
      const { data } = await api.post('/analytics/bayes', {
        name: bayesName,
        question,
        prior_probability: Number(prior),
        likelihood_if_true: Number(likelihoodTrue),
        likelihood_if_false: Number(likelihoodFalse),
      })
      setBayesianResult(data)
      const history = await api.get<BayesianAnalysis[]>('/analytics/bayes')
      setBayesianHistory(history.data)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy('')
    }
  }

  async function generateInsights() {
    setBusy('insights')
    setError('')
    try {
      const { data } = await api.post<Insight[]>('/analytics/insights/generate', null, { params: dates })
      setInsights((current) => [...data, ...current])
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy('')
    }
  }

  async function setInsightStatus(insight: Insight, status: Insight['status']) {
    try {
      const { data } = await api.patch<Insight>(`/analytics/insights/${insight.id}`, { status })
      setInsights((current) => current.map((item) => item.id === data.id ? data : item))
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  async function exportReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('report')
    setError('')
    try {
      const { data } = await api.post<Blob>('/analytics/reports/export', { ...dates, format: reportFormat }, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `ventas-${dates.start_date}-${dates.end_date}.${reportFormat}`
      anchor.click()
      URL.revokeObjectURL(url)
      const history = await api.get<AnalyticsReport[]>('/analytics/reports')
      setReports(history.data)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy('')
    }
  }

  const chartData = dashboard?.daily_sales.map((item) => ({ ...item, label: dateShort(item.date) })) ?? []
  const metrics = dashboard ? [
    { label: 'Ingresos del periodo', value: currency(dashboard.revenue), detail: dashboard.revenue_change_percent === null ? 'Sin periodo comparable' : `${dashboard.revenue_change_percent >= 0 ? '+' : ''}${dashboard.revenue_change_percent.toFixed(1)}% frente al periodo previo`, tone: 'revenue' },
    { label: 'Ventas completadas', value: String(dashboard.sales_count), detail: `Ticket promedio ${currency(dashboard.average_ticket)}`, tone: 'orders' },
    { label: 'Clientes activos', value: String(dashboard.active_customers), detail: 'En la cartera comercial', tone: 'customers' },
    { label: 'Stock bajo', value: String(dashboard.low_stock_products), detail: 'Productos en su mínimo', tone: 'stock' },
  ] : []

  return (
    <>
      <PageHeader eyebrow="ANÁLISIS EMPRESARIAL" title="Analítica" description="Tendencias, cálculos estadísticos e información accionable de tu operación." />
      <div className="analytics-toolbar">
        <div className="analytics-tabs" role="tablist" aria-label="Módulos de analítica">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
              <Icon size={16} />{label}
            </button>
          ))}
        </div>
        <div className="analytics-date-range">
          <label>Desde<input type="date" value={dates.start_date} max={dates.end_date} onChange={(event) => setDates((current) => ({ ...current, start_date: event.target.value }))} /></label>
          <label>Hasta<input type="date" value={dates.end_date} min={dates.start_date} onChange={(event) => setDates((current) => ({ ...current, end_date: event.target.value }))} /></label>
        </div>
      </div>
      {error && <ErrorMessage message={error} />}

      {tab === 'dashboard' && (dashboardLoading ? <Loading label="Calculando indicadores…" /> : dashboard && <>
        <div className="analytics-kpi-grid">
          {metrics.map((metric) => <article className={`analytics-kpi ${metric.tone}`} key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></article>)}
        </div>
        <div className="analytics-chart-grid">
          <section className="analytics-panel analytics-wide-panel">
            <div className="analytics-panel-heading"><div><span className="eyebrow">EVOLUCIÓN</span><h2>Ingresos por día</h2><p>Ventas completadas dentro del periodo seleccionado</p></div><Activity size={18} /></div>
            {chartData.length ? <div className="analytics-chart"><ResponsiveContainer width="100%" height="100"><LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e9edf4" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8390a2', fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8390a2', fontSize: 10 }} tickFormatter={(value: number) => `S/${value}`} width={52} /><Tooltip formatter={(value) => [currency(Number(value)), 'Ingresos']} /><Line type="monotone" dataKey="total" stroke="#2572d8" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} /></LineChart></ResponsiveContainer></div> : <div className="analytics-empty">No hay ventas completadas en este periodo.</div>}
          </section>
          <section className="analytics-panel">
            <div className="analytics-panel-heading"><div><span className="eyebrow">CATÁLOGO</span><h2>Productos principales</h2><p>Ordenados por ingreso generado</p></div></div>
            {dashboard.top_products.length ? <div className="analytics-chart analytics-short-chart"><ResponsiveContainer width="100%" height="100"><BarChart data={dashboard.top_products} layout="vertical" margin={{ left: 8, right: 18 }}><CartesianGrid strokeDasharray="3 5" horizontal={false} stroke="#e9edf4" /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={100} axisLine={false} tickLine={false} tick={{ fill: '#59677c', fontSize: 10 }} /><Tooltip formatter={(value) => [currency(Number(value)), 'Ingresos']} /><Bar dataKey="revenue" fill="#24a587" radius={[0, 4, 4, 0]} barSize={15} /></BarChart></ResponsiveContainer></div> : <div className="analytics-empty">Todavía no hay productos vendidos.</div>}
          </section>
          <section className="analytics-panel">
            <div className="analytics-panel-heading"><div><span className="eyebrow">COBROS</span><h2>Métodos de pago</h2><p>Importe registrado por método</p></div></div>
            {dashboard.payment_methods.length ? <div className="analytics-payment-layout"><div className="analytics-chart analytics-pie-chart"><ResponsiveContainer width="100%" height="100"><PieChart><Pie data={dashboard.payment_methods} dataKey="amount" nameKey="method" innerRadius={45} outerRadius={72} paddingAngle={3}>{dashboard.payment_methods.map((item, index) => <Cell key={item.method} fill={palette[index % palette.length]} />)}</Pie><Tooltip formatter={(value) => currency(Number(value))} /></PieChart></ResponsiveContainer></div><div className="analytics-legend">{dashboard.payment_methods.map((item, index) => <div key={item.method}><i style={{ backgroundColor: palette[index % palette.length] }} /><span>{item.method}</span><strong>{currency(item.amount)}</strong></div>)}</div></div> : <div className="analytics-empty">No hay pagos registrados en el periodo.</div>}
          </section>
        </div>
      </>)}

      {tab === 'statistics' && <div className="analytics-workspace-grid">
        <section className="analytics-panel">
          <div className="analytics-panel-heading"><div><span className="eyebrow">FASE 09</span><h2>Estadística descriptiva</h2><p>Calcula medidas sobre una serie numérica y conserva el análisis.</p></div><Sigma size={18} /></div>
          <form className="analytics-form" onSubmit={submitStatistics}>
            <label>Nombre del análisis<input value={analysisName} onChange={(event) => setAnalysisName(event.target.value)} minLength={2} maxLength={160} required /></label>
            <label>Variable medida<input value={variableName} onChange={(event) => setVariableName(event.target.value)} maxLength={100} required /></label>
            <label>Valores numéricos<textarea value={valuesText} onChange={(event) => setValuesText(event.target.value)} rows={3} required /><small>Separa los valores con comas, espacios o saltos de línea.</small></label>
            <label>Umbral para P(X ≥ x)<input type="number" step="any" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>
            <button className="button button-primary" disabled={busy === 'statistics'}>{busy === 'statistics' ? <LoaderCircle size={16} className="analytics-spin" /> : <FlaskConical size={16} />} Calcular y guardar</button>
          </form>
          {calculation && <div className="analytics-result"><div className="analytics-result-heading"><strong>{calculation.name}</strong><span>{calculation.results.count} observaciones</span></div><div className="analytics-stat-grid">{[
            ['Media', calculation.results.mean], ['Mediana', calculation.results.median], ['Desv. estándar', calculation.results.standard_deviation_population], ['Mínimo', calculation.results.minimum], ['Máximo', calculation.results.maximum], ['Probabilidad', calculation.results.probability_at_or_above_threshold === null ? null : `${(Number(calculation.results.probability_at_or_above_threshold) * 100).toFixed(1)}%`],
          ].map(([label, value]) => <div key={String(label)}><small>{label}</small><strong>{value === null ? 'Sin umbral' : typeof value === 'number' ? value.toFixed(2) : value}</strong></div>)}</div></div>}
          <div className="analytics-history"><h3>Análisis recientes</h3>{statistics.slice(0, 5).map((item) => <div className="analytics-history-row" key={item.id}><span><strong>{item.name}</strong><small>{dateTime(item.created_at)}</small></span><span>Media: {Number(item.results.mean ?? 0).toFixed(2)}</span></div>)}{!statistics.length && <p className="analytics-muted">Aún no hay análisis guardados.</p>}</div>
        </section>
        <section className="analytics-panel">
          <div className="analytics-panel-heading"><div><span className="eyebrow">PROBABILIDAD</span><h2>Teorema de Bayes</h2><p>Actualiza la probabilidad de una hipótesis ante una evidencia.</p></div><Sparkles size={18} /></div>
          <form className="analytics-form" onSubmit={submitBayes}>
            <label>Nombre<input value={bayesName} onChange={(event) => setBayesName(event.target.value)} minLength={2} maxLength={160} required /></label>
            <label>Hipótesis<input value={question} onChange={(event) => setQuestion(event.target.value)} minLength={5} maxLength={1000} required /></label>
            <div className="analytics-probability-grid"><label>P(H) previa<input type="number" min="0" max="1" step="0.01" value={prior} onChange={(event) => setPrior(event.target.value)} required /></label><label>P(E|H)<input type="number" min="0" max="1" step="0.01" value={likelihoodTrue} onChange={(event) => setLikelihoodTrue(event.target.value)} required /></label><label>P(E|¬H)<input type="number" min="0" max="1" step="0.01" value={likelihoodFalse} onChange={(event) => setLikelihoodFalse(event.target.value)} required /></label></div>
            <p className="analytics-formula">P(H|E) = P(E|H) · P(H) / P(E)</p>
            <button className="button button-primary" disabled={busy === 'bayes'}>{busy === 'bayes' ? <LoaderCircle size={16} className="analytics-spin" /> : <Sigma size={16} />} Calcular posterior</button>
          </form>
          {bayesianResult && <div className="analytics-posterior"><span>Probabilidad posterior</span><strong>{(bayesianResult.posterior_probability * 100).toFixed(2)}%</strong><small>Probabilidad de la evidencia: {(bayesianResult.evidence_probability * 100).toFixed(2)}%</small></div>}
          <div className="analytics-history"><h3>Análisis Bayes recientes</h3>{bayesianHistory.slice(0, 5).map((item) => <div className="analytics-history-row" key={item.id}><span><strong>{item.name}</strong><small>{item.question}</small></span><span>{item.posterior_probability === null ? '—' : `${(item.posterior_probability * 100).toFixed(1)}%`}</span></div>)}{!bayesianHistory.length && <p className="analytics-muted">Aún no hay análisis guardados.</p>}</div>
        </section>
      </div>}

      {tab === 'insights' && <section className="analytics-panel">
        <div className="analytics-panel-heading"><div><span className="eyebrow">FASE 11</span><h2>Insights empresariales</h2><p>Reglas transparentes basadas en ventas y existencias del periodo.</p></div><button className="button button-primary" type="button" onClick={generateInsights} disabled={busy === 'insights'}>{busy === 'insights' ? <LoaderCircle size={16} className="analytics-spin" /> : <Sparkles size={16} />} Generar insights</button></div>
        <div className="analytics-insight-list">{insights.map((insight) => <article className={`analytics-insight severity-${insight.severity}`} key={insight.id}><div className="analytics-insight-mark"><Lightbulb size={17} /></div><div className="analytics-insight-content"><div className="analytics-insight-title"><strong>{insight.title}</strong><span className={`analytics-status status-${insight.status}`}>{insight.status === 'new' ? 'Nuevo' : insight.status === 'read' ? 'Revisado' : 'Descartado'}</span></div><p>{insight.description}</p>{insight.evidence.map((entry, index) => <details key={`${insight.id}-${index}`}><summary>Ver evidencia</summary><pre>{JSON.stringify(entry.evidence, null, 2)}</pre></details>)}</div><div className="analytics-insight-actions">{insight.status === 'new' && <button type="button" className="icon-button" title="Marcar revisado" aria-label="Marcar revisado" onClick={() => setInsightStatus(insight, 'read')}><Check size={16} /></button>}{insight.status !== 'dismissed' && <button type="button" className="icon-button" title="Descartar" aria-label="Descartar insight" onClick={() => setInsightStatus(insight, 'dismissed')}><X size={16} /></button>}</div></article>)}{!insights.length && <div className="analytics-empty">Genera insights para detectar tendencias y alertas de stock.</div>}</div>
      </section>}

      {tab === 'reports' && <div className="analytics-workspace-grid reports-grid">
        <section className="analytics-panel">
          <div className="analytics-panel-heading"><div><span className="eyebrow">FASE 12</span><h2>Exportar informe analítico</h2><p>Descarga métricas comerciales, análisis descriptivos y resultados Bayes del periodo.</p></div><Download size={18} /></div>
          <form className="analytics-form" onSubmit={exportReport}>
            <label>Desde<input type="date" value={dates.start_date} max={dates.end_date} onChange={(event) => setDates((current) => ({ ...current, start_date: event.target.value }))} required /></label>
            <label>Hasta<input type="date" value={dates.end_date} min={dates.start_date} onChange={(event) => setDates((current) => ({ ...current, end_date: event.target.value }))} required /></label>
            <label>Formato<select value={reportFormat} onChange={(event) => setReportFormat(event.target.value as 'csv' | 'json')}><option value="csv">CSV para hojas de cálculo</option><option value="json">JSON</option></select></label>
            <button className="button button-primary" disabled={busy === 'report'}>{busy === 'report' ? <LoaderCircle size={16} className="analytics-spin" /> : <Download size={16} />} Descargar informe</button>
          </form>
        </section>
        <section className="analytics-panel">
          <div className="analytics-panel-heading"><div><span className="eyebrow">HISTORIAL</span><h2>Informes generados</h2><p>Registro de exportaciones realizadas.</p></div></div>
          <div className="analytics-report-list">{reports.map((report) => <div className="analytics-report-row" key={report.id}><span className="analytics-report-icon"><FileSpreadsheet size={16} /></span><span><strong>{report.name}</strong><small>{dateTime(report.created_at)}</small></span><span className="analytics-status status-read">{report.parameters.format === 'json' ? 'JSON' : 'CSV'}</span></div>)}{!reports.length && <div className="analytics-empty">Todavía no se han generado informes.</div>}</div>
        </section>
      </div>}
    </>
  )
}
