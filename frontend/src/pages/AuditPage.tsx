import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Building2,
  CheckCircle2,
  Clock3,
  FileClock,
  Globe2,
  Info,
  MapPin,
  Network,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { api, errorMessage } from '../api'
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback'
import PageHeader from '../components/PageHeader'
import type { AuditLog, IpRegistryEntry, LocationData } from '../types'
import { dateTime } from '../utils'
import './audit.css'

type AuditTab = 'location' | 'history' | 'registry'

const tabs: { id: AuditTab; label: string; icon: typeof Activity }[] = [
  { id: 'location', label: 'Ubicación', icon: MapPin },
  { id: 'history', label: 'Registro', icon: FileClock },
  { id: 'registry', label: 'Registro IP', icon: Network },
]

const emptyLocation: LocationData = {
  ip_address: '—',
  country: 'No disponible',
  region: '',
  city: '',
  latitude: 0,
  longitude: 0,
  postal_code: null,
}

function projectLocation(latitude: number, longitude: number) {
  const x = 50 + ((longitude + 81.2) / 12.2) * 100
  const y = 50 - ((latitude + 12.5) / 9.3) * 100
  return {
    x: Math.max(4, Math.min(96, x)),
    y: Math.max(8, Math.min(92, y)),
  }
}

function PeruMap({ location, registry }: { location: LocationData; registry: IpRegistryEntry[] }) {
  const currentLocation = location.country !== 'No disponible' && location.latitude !== 0 && location.longitude !== 0
    ? location
    : null
  const currentPoint = currentLocation ? projectLocation(currentLocation.latitude, currentLocation.longitude) : null
  const points = registry
    .filter((entry) => entry.latitude !== null && entry.longitude !== null)
    .map((entry) => ({
      ...entry,
      ...projectLocation(entry.latitude as number, entry.longitude as number),
    }))

  return (
    <div className="audit-map-shell">
      <div className="audit-map-canvas" aria-label="Mapa geográfico de Perú con conexiones registradas">
        <img src="/audit-peru-map.png" alt="Mapa del Perú" className="audit-map-image" />
        <div className="audit-map-grid" aria-hidden="true" />
        {points.map((point) => (
          <button
            key={point.ip_address}
            type="button"
            className="audit-map-point"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            title={`${point.city || point.region || 'Ubicación'} · ${point.ip_address}`}
            aria-label={`IP registrada en ${point.city || point.region || 'Perú'}`}
          >
            <span />
          </button>
        ))}
        {currentPoint && (
          <div className="audit-map-current" style={{ left: `${currentPoint.x}%`, top: `${currentPoint.y}%` }}>
            <span className="audit-map-current-pulse" />
            <span className="audit-map-current-dot" />
          </div>
        )}
        <div className="audit-map-scale"><span>0</span><i /><span>100 km</span></div>
        <div className="audit-map-status">
          <span className="audit-map-status-dot" />
          {currentLocation ? 'Ubicación actual disponible' : 'Geolocalización no disponible'}
        </div>
      </div>
      <div className="audit-map-footer">
        <span><i className="audit-map-key audit-map-key-current" />Tu conexión</span>
        <span><i className="audit-map-key audit-map-key-registered" />IP registrada</span>
        <span className="audit-map-source">Mapa de referencia · Perú</span>
      </div>
    </div>
  )
}

function LocationPanel({ location, registry, loading }: { location: LocationData | null; registry: IpRegistryEntry[]; loading: boolean }) {
  const geolocalizable = registry.filter((entry) => entry.latitude !== null && entry.longitude !== null).length
  const locationLabel = location?.city || location?.region || 'No disponible'

  return (
    <div className="audit-location-layout">
      <section className="panel audit-map-panel">
        <div className="panel-heading audit-panel-heading">
          <div>
            <span className="eyebrow">GEOREFERENCIA</span>
            <h2>Ubicación de conexiones</h2>
            <p>Mapa de Perú con la ubicación actual y los puntos de IP registrados.</p>
          </div>
          <span className={`audit-availability ${location?.country === 'No disponible' ? 'audit-availability-warning' : ''}`}>
            <Globe2 size={13} /> {location?.country || 'Sin país'}
          </span>
        </div>
        {loading ? <Loading label="Cargando mapa de auditoría…" /> : <PeruMap location={location ?? emptyLocation} registry={registry} />}
      </section>

      <aside className="audit-location-sidebar">
        <section className="panel audit-summary-panel">
          <div className="panel-heading compact-heading">
            <div><span className="eyebrow">RESUMEN</span><h2>Estado de ubicación</h2></div>
            <ShieldCheck size={18} />
          </div>
          <div className="audit-location-summary">
            <div className="audit-location-summary-icon"><MapPin size={18} /></div>
            <div><span>Ubicación actual</span><strong>{locationLabel}</strong><small>{location?.ip_address || 'Dirección IP no disponible'}</small></div>
          </div>
          <div className="audit-stat-grid">
            <div><span>Coordenadas</span><strong>{location && location.latitude && location.longitude ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : '—'}</strong></div>
            <div><span>IP verificadas</span><strong>{registry.length}</strong></div>
            <div><span>Puntos geolocalizables</span><strong>{geolocalizable}</strong></div>
            <div><span>País</span><strong>{location?.country || '—'}</strong></div>
          </div>
          <div className="audit-information-note"><Info size={14} /><span>La ubicación se obtiene desde la dirección IP y puede no representar el sitio físico exacto del usuario.</span></div>
        </section>

        <section className="panel audit-connections-panel">
          <div className="panel-heading compact-heading"><div><span className="eyebrow">CONEXIONES</span><h2>Registro reciente</h2></div><Network size={18} /></div>
          <div className="audit-connection-list">
            {registry.slice(0, 5).map((entry) => (
              <div className="audit-connection-item" key={entry.ip_address}>
                <span className="audit-connection-icon"><Globe2 size={14} /></span>
                <div><strong>{entry.ip_address}</strong><small>{entry.city || entry.region || 'Ubicación desconocida'}</small></div>
                <span className="audit-connection-count">{entry.action_count}</span>
              </div>
            ))}
            {registry.length === 0 && <div className="audit-empty-inline">No hay conexiones registradas.</div>}
          </div>
        </section>
      </aside>
    </div>
  )
}

function HistoryPanel({ logs, loading }: { logs: AuditLog[]; loading: boolean }) {
  return (
    <section className="panel audit-history-panel">
      <div className="panel-heading audit-panel-heading">
        <div><span className="eyebrow">TRAZABILIDAD</span><h2>Registro de actividades</h2><p>Las acciones recientes de la compañía organizadas por fecha y usuario.</p></div>
        <span className="audit-count-badge"><Activity size={13} /> {logs.length} acciones</span>
      </div>
      {loading ? <Loading label="Cargando registro de actividades…" /> : logs.length ? (
        <div className="audit-history-list">
          {logs.map((log) => (
            <article className="audit-history-item" key={log.id}>
              <span className="audit-history-icon"><FileClock size={16} /></span>
              <div className="audit-history-main">
                <div className="audit-history-title"><strong>{log.action.split('_').join(' ')}</strong><span className="type-pill">{log.entity_type}{log.entity_id ? ` · ${log.entity_id}` : ''}</span></div>
                <div className="audit-history-meta"><span><UserRound size={12} /> {log.user_id ? `Usuario ${log.user_id}` : 'Sistema'}</span><span><Globe2 size={12} /> {log.ip_address || 'Sin IP'}</span></div>
                <pre>{JSON.stringify(log.details, null, 2)}</pre>
              </div>
              <time dateTime={log.created_at}>{dateTime(log.created_at)}</time>
            </article>
          ))}
        </div>
      ) : <EmptyState title="Sin actividades registradas" description="Las acciones realizadas aparecerán aquí." />}
    </section>
  )
}

function RegistryPanel({ entries, loading }: { entries: IpRegistryEntry[]; loading: boolean }) {
  return (
    <section className="panel audit-registry-panel-main">
      <div className="panel-heading audit-panel-heading">
        <div><span className="eyebrow">SEGURIDAD</span><h2>Registro de direcciones IP</h2><p>Direcciones de la compañía y su evolución reciente.</p></div>
        <span className="audit-count-badge"><Network size={13} /> {entries.length} IP</span>
      </div>
      {loading ? <Loading label="Cargando registro de IPs…" /> : entries.length ? (
        <div className="audit-registry-table-wrap">
          <table className="audit-registry-table">
            <thead><tr><th>Dirección IP</th><th>Última conexión</th><th>Acciones</th><th>Usuarios</th><th>Agentes</th></tr></thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.ip_address}>
                  <td><span className="audit-ip-cell"><Network size={14} />{entry.ip_address}</span></td>
                  <td>{dateTime(entry.last_seen)}</td>
                  <td><span className="audit-count-cell">{entry.action_count}</span></td>
                  <td>{entry.users.length}</td>
                  <td><span className="audit-agent-count">{entry.user_agents.length}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState title="Sin IP registradas" description="Las direcciones IP aparecerán después de que haya acciones con una dirección válida." />}
    </section>
  )
}

export default function AuditPage() {
  const [tab, setTab] = useState<AuditTab>('location')
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [location, setLocation] = useState<LocationData | null>(null)
  const [registry, setRegistry] = useState<IpRegistryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [locationLoading, setLocationLoading] = useState(true)
  const [registryLoading, setRegistryLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [logsResponse, locationResponse, registryResponse] = await Promise.all([
          api.get<AuditLog[]>('/audit/logs'),
          api.get<LocationData>('/audit/location'),
          api.get<IpRegistryEntry[]>('/audit/ip-registry'),
        ])
        if (!active) return
        setLogs(logsResponse.data)
        setLocation(locationResponse.data)
        setRegistry(registryResponse.data)
      } catch (cause) {
        if (active) setError(errorMessage(cause))
      } finally {
        if (active) {
          setLoading(false)
          setLocationLoading(false)
          setRegistryLoading(false)
        }
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const summary = useMemo(() => ({
    total: registry.length,
    geolocalizable: registry.filter((entry) => entry.latitude !== null && entry.longitude !== null).length,
    actions: logs.length,
  }), [logs.length, registry])

  return (
    <div className="audit-page">
      <PageHeader
        eyebrow="CONTROL DE ACCESO"
        title="Auditoría"
        description="Monitoreo de actividades, ubicación de conexiones y direcciones IP en un entorno seguro."
        action={<div className="audit-header-status"><CheckCircle2 size={15} /><span>Seguimiento activo</span></div>}
      />
      {error && <ErrorMessage message={error} />}
      <div className="audit-overview-grid">
        <div className="audit-overview-card"><span className="audit-overview-icon audit-overview-blue"><ShieldCheck size={17} /></span><div><small>Actividades registradas</small><strong>{summary.actions}</strong><span>Últimas 200 acciones</span></div></div>
        <div className="audit-overview-card"><span className="audit-overview-icon audit-overview-green"><Globe2 size={17} /></span><div><small>Direcciones IP</small><strong>{summary.total}</strong><span>En el registro</span></div></div>
        <div className="audit-overview-card"><span className="audit-overview-icon audit-overview-purple"><MapPin size={17} /></span><div><small>Puntos geolocalizables</small><strong>{summary.geolocalizable}</strong><span>Con coordenadas válidas</span></div></div>
        <div className="audit-overview-card"><span className="audit-overview-icon audit-overview-orange"><Building2 size={17} /></span><div><small>Compañía</small><strong>Empresa</strong><span>Registro corporativo</span></div></div>
      </div>
      <div className="audit-tabs" role="tablist" aria-label="Secciones de auditoría">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`audit-tab ${tab === id ? 'active' : ''}`} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {tab === 'location' && <LocationPanel location={location} registry={registry} loading={locationLoading} />}
      {tab === 'history' && <HistoryPanel logs={logs} loading={loading} />}
      {tab === 'registry' && <RegistryPanel entries={registry} loading={registryLoading} />}
      <div className="audit-security-footer"><Clock3 size={14} /><span>Registro de auditoría actualizado automáticamente.</span></div>
    </div>
  )
}
