import { useEffect, useState, type FormEvent } from 'react'
import { MapPinned, Pencil, Plus, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../api'
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import type { Branch } from '../types'
import { useRealtimeRefresh } from '../useRealtimeRefresh'
import './branches.css'

const emptyForm = { name: '', address: '', latitude: '', longitude: '' }

function mapPoint(latitude: number, longitude: number) {
  return {
    x: Math.max(4, Math.min(96, 50 + ((longitude + 81.2) / 12.2) * 100)),
    y: Math.max(8, Math.min(92, 50 - ((latitude + 12.5) / 9.3) * 100)),
  }
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Branch | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function loadBranches() {
    setLoading(true)
    try {
      const { data } = await api.get<Branch[]>('/branches')
      setBranches(data)
      setError('')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadBranches() }, [])
  useRealtimeRefresh(loadBranches)

  function openForm(branch: Branch | null = null) {
    setEditing(branch)
    setForm(branch ? {
      name: branch.name,
      address: branch.address ?? '',
      latitude: String(branch.latitude),
      longitude: String(branch.longitude),
    } : emptyForm)
    setFormOpen(true)
  }

  async function saveBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      }
      if (editing) await api.put(`/branches/${editing.id}`, payload)
      else await api.post('/branches', payload)
      setFormOpen(false)
      setEditing(null)
      setForm(emptyForm)
      await loadBranches()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(branch: Branch) {
    if (branch.is_active) {
      if (!window.confirm(`¿Desactivar la sucursal «${branch.name}»?`)) return
      try {
        await api.delete(`/branches/${branch.id}`)
        await loadBranches()
      } catch (cause) {
        setError(errorMessage(cause))
      }
      return
    }
    try {
      await api.put(`/branches/${branch.id}`, {
        name: branch.name,
        address: branch.address,
        latitude: branch.latitude,
        longitude: branch.longitude,
      })
      await loadBranches()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  const activeBranches = branches.filter((branch) => branch.is_active)

  return <>
    <PageHeader
      eyebrow="MANTENIMIENTO COMERCIAL"
      title="Sucursales"
      description="Registra las sedes de la empresa y visualiza su ubicación en el mapa del Perú."
      action={<button className="button button-primary" onClick={() => openForm()}><Plus size={16} /> Nueva sucursal</button>}
    />
    {error && <ErrorMessage message={error} />}
    <section className="panel branches-map-panel">
      <div className="branches-panel-heading">
        <div><span className="eyebrow">UBICACIÓN DE SEDES</span><h2>Mapa del Perú</h2><p>Se muestran solo las sucursales activas con coordenadas registradas.</p></div>
        <span className="branches-map-count"><MapPinned size={14} /> {activeBranches.length} activas</span>
      </div>
      <div className="branches-map">
        <img src="/audit-peru-map.png" alt="Mapa del Perú" />
        {activeBranches.map((branch) => {
          const point = mapPoint(branch.latitude, branch.longitude)
          return <button
            key={branch.id}
            type="button"
            className="branches-map-marker"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            title={`${branch.name}${branch.address ? ` · ${branch.address}` : ''}`}
            aria-label={`Sucursal ${branch.name}`}
          ><span /></button>
        })}
        {!activeBranches.length && !loading && <span className="branches-map-empty">Registra una sucursal activa para ubicarla aquí.</span>}
      </div>
      <div className="branches-map-legend"><i /> Sucursal activa <span>Coordenadas en grados decimales</span></div>
    </section>

    <section className="panel table-panel branches-table-panel">
      <div className="table-toolbar"><div className="table-heading"><div className="table-icon products-icon"><MapPinned size={18} /></div><div><strong>Directorio de sucursales</strong><span>{branches.length} sedes registradas</span></div></div></div>
      {loading ? <Loading /> : branches.length ? <div className="table-scroll">
        <table><thead><tr><th>SUCURSAL</th><th>DIRECCIÓN</th><th>LATITUD</th><th>LONGITUD</th><th>ESTADO</th><th>ACCIONES</th></tr></thead>
          <tbody>{branches.map((branch) => <tr key={branch.id}>
            <td><strong>{branch.name}</strong></td><td>{branch.address || 'Sin dirección'}</td>
            <td>{branch.latitude.toFixed(6)}</td><td>{branch.longitude.toFixed(6)}</td>
            <td><span className={`status-pill ${branch.is_active ? 'status-active' : 'status-inactive'}`}><i />{branch.is_active ? 'Activa' : 'Inactiva'}</span></td>
            <td><div className="row-actions">
              <button className="icon-button" onClick={() => openForm(branch)} aria-label={`Editar ${branch.name}`}><Pencil size={15} /></button>
              <button className={`icon-button${branch.is_active ? ' danger-action' : ''}`} onClick={() => void toggleActive(branch)} aria-label={`${branch.is_active ? 'Desactivar' : 'Reactivar'} ${branch.name}`}>{branch.is_active ? <Trash2 size={15} /> : <Plus size={15} />}</button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div> : <EmptyState title="No hay sucursales" description="Agrega una sede con coordenadas dentro del Perú para verla en el mapa." />}
    </section>

    {formOpen && <Modal
      title={editing ? 'Editar sucursal' : 'Nueva sucursal'}
      description="Las coordenadas se validan dentro del territorio peruano."
      onClose={() => { setFormOpen(false); setEditing(null); setForm(emptyForm) }}
      onSubmit={saveBranch}
      submitLabel={saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear sucursal'}
    >
      <div className="form-grid">
        <label className="form-field span-2">Nombre<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} maxLength={160} required placeholder="Ej. Sede Lima Centro" /></label>
        <label className="form-field span-2">Dirección<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} maxLength={255} placeholder="Distrito, provincia, departamento" /></label>
        <label className="form-field">Latitud<input type="number" min="-18.5" max="0.2" step="0.000001" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} required placeholder="-12.0464" /></label>
        <label className="form-field">Longitud<input type="number" min="-81.5" max="-68.5" step="0.000001" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} required placeholder="-77.0428" /></label>
      </div>
    </Modal>}
  </>
}
