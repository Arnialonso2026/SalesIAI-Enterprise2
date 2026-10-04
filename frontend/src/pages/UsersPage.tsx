import { FormEvent, useEffect, useState } from 'react'
import { KeyRound, LockKeyhole, Plus, ShieldCheck, Trash2, UserRoundCog, Users } from 'lucide-react'
import { api, errorMessage } from '../api'
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../App'
import type { User } from '../types'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'seller', label: 'Vendedor' },
  { value: 'analyst', label: 'Analista' },
  { value: 'warehouse', label: 'Almacén' },
]
const roleLabels = Object.fromEntries(ROLE_OPTIONS.map(({ value, label }) => [value, label]))
const blank = { full_name: '', email: '', dni: '', password: '', role: 'seller', is_active: true }

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState(blank)

  async function loadUsers() {
    setLoading(true)
    try {
      const { data } = await api.get<User[]>('/users')
      setUsers(data)
      setError('')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadUsers() }, [])

  function openCreate() {
    setEditing(null)
    setForm(blank)
    setDialogOpen(true)
  }

  function openEdit(user: User) {
    setEditing(user)
    setForm({
      full_name: user.full_name,
      email: user.email ?? '',
      dni: user.dni ?? '',
      password: '',
      role: user.role,
      is_active: user.is_active,
    })
    setDialogOpen(true)
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const payload: Record<string, unknown> = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      dni: form.dni.trim() || null,
      role: form.role,
    }
    if (editing) payload.is_active = form.is_active
    if (!editing || form.password) payload.password = form.password

    try {
      if (editing) await api.put(`/users/${editing.id}`, payload)
      else await api.post('/users', payload)
      setDialogOpen(false)
      await loadUsers()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  async function clearPassword(user: User) {
    if (!window.confirm(`¿Quitar la contraseña de ${user.full_name}? La cuenta quedará desactivada hasta asignarle una nueva.`)) return
    try {
      await api.post(`/users/${user.id}/clear-password`)
      await loadUsers()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  async function removeUser(user: User) {
    if (!window.confirm(`¿Eliminar el acceso de ${user.full_name}? Se quitarán su DNI, correo y contraseña, y sus ventas históricas se conservarán.`)) return
    try {
      await api.delete(`/users/${user.id}`)
      await loadUsers()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return <>
    <PageHeader
      eyebrow="ADMINISTRACIÓN DEL SISTEMA"
      title="Usuarios y roles"
      description="Crea cuentas y administra el DNI, la contraseña y el rol de acceso de cada persona."
      action={<button className="button button-primary" onClick={openCreate}><Plus size={17} /> Agregar usuario</button>}
    />
    {error && <ErrorMessage message={error} />}
    <div className="user-role-summary">
      <div className="user-summary-icon"><ShieldCheck size={19} /></div>
      <div><strong>Acceso por responsabilidades</strong><span>El rol se valida en la API; ocultar una pantalla no sustituye los permisos del servidor.</span></div>
      <div className="role-chips">{ROLE_OPTIONS.map((role) => <span key={role.value}>{role.label}</span>)}</div>
    </div>
    <section className="panel table-panel user-table-panel">
      <div className="table-toolbar">
        <div className="table-heading"><div className="table-icon users-icon"><Users size={18} /></div><div><strong>Directorio de usuarios</strong><span>{users.filter((user) => user.is_active).length} activos · {users.length} cuentas</span></div></div>
      </div>
      {loading ? <Loading label="Cargando usuarios…" /> : users.length ? <div className="table-scroll"><table><thead><tr><th>USUARIO</th><th>DNI</th><th>ROL</th><th>CONTRASEÑA</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}>
        <td><div className="user-directory-cell"><span className="user-directory-avatar">{user.full_name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div><strong>{user.full_name}</strong><small>{user.email || 'Sin correo asignado'}</small></div></div></td>
        <td><span className="document-code">{user.dni || '—'}</span></td>
        <td><span className={`role-pill role-${user.role}`}>{roleLabels[user.role] ?? user.role}</span></td>
        <td><span className={`credential-status ${user.password_configured ? 'credential-set' : 'credential-missing'}`}><i />{user.password_configured ? 'Asignada' : 'Sin contraseña'}</span></td>
        <td><span className={`status-pill ${user.is_active ? 'status-active' : 'status-low'}`}><i />{user.is_active ? 'Activo' : 'Desactivado'}</span></td>
        <td><div className="row-actions"><button className="button button-small button-secondary" onClick={() => openEdit(user)}><UserRoundCog size={14} /> Editar</button>{user.id !== currentUser?.id && <>{user.password_configured && <button className="icon-button" onClick={() => void clearPassword(user)} title="Quitar contraseña" aria-label={`Quitar contraseña a ${user.full_name}`}><KeyRound size={15} /></button>}<button className="icon-button danger-action" onClick={() => void removeUser(user)} title="Eliminar acceso" aria-label={`Eliminar acceso de ${user.full_name}`}><Trash2 size={15} /></button></>}</div></td>
      </tr>)}</tbody></table></div> : <EmptyState title="Aún no hay usuarios" description="Crea una cuenta para asignar DNI, contraseña y rol." />}
    </section>
    <div className="table-footnote">La contraseña nunca se muestra después de guardarla. Eliminar acceso retira sus credenciales y conserva las ventas históricas.</div>
    {dialogOpen && <Modal
      title={editing ? `Editar · ${editing.full_name}` : 'Agregar usuario'}
      description={editing ? 'Actualiza el acceso. Deja la contraseña vacía para conservarla.' : 'Asigna DNI, contraseña y rol para habilitar el inicio de sesión.'}
      onClose={() => setDialogOpen(false)}
      onSubmit={saveUser}
      submitLabel={saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear usuario'}
    >
      <div className="form-grid">
        <label className="form-field span-2">Nombre completo<input autoFocus value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} minLength={2} maxLength={160} required placeholder="Ej. Ana Torres" /></label>
        <label className="form-field">DNI<input type="text" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={form.dni} onChange={(event) => setForm({ ...form, dni: event.target.value.replace(/\D/g, '').slice(0, 8) })} placeholder="8 dígitos" />{editing && <small>Déjalo vacío para quitar el DNI y desactivar el acceso.</small>}</label>
        <label className="form-field">Correo (opcional)<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={255} placeholder="persona@empresa.com" /></label>
        <label className="form-field">Rol<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} required>{ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
        <label className="form-field">{editing ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}<div className="password-input-wrap"><LockKeyhole size={15} /><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={8} maxLength={128} autoComplete="new-password" required={!editing} placeholder={editing ? 'Vacío = mantener actual' : 'Mínimo 8 caracteres'} /></div><small>{editing ? 'Escribe una nueva para reemplazar la actual.' : 'Se guardará cifrada; no se volverá a mostrar.'}</small></label>
        {editing && <label className="form-field">Estado de la cuenta<select value={form.is_active ? 'active' : 'inactive'} onChange={(event) => setForm({ ...form, is_active: event.target.value === 'active' })}><option value="active">Activo</option><option value="inactive">Desactivado</option></select></label>}
      </div>
    </Modal>}
  </>
}
