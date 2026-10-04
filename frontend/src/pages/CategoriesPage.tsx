import { FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, FolderOpen, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import type { Category } from '../types'
import { useRealtimeRefresh } from '../useRealtimeRefresh'

const blank = { name: '', description: '' }

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Category | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try { const { data } = await api.get<Category[]>('/categories'); setCategories(data); setError('') }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  useRealtimeRefresh(load)

  function openForm(category: Category | null = null) {
    setEditing(category)
    setForm(category ? { name: category.name, description: category.description ?? '' } : blank)
    setOpen(true)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { name: form.name, description: form.description || null }
      if (editing) await api.put(`/categories/${editing.id}`, payload)
      else await api.post('/categories', payload)
      setEditing(null); setForm(blank); setOpen(false); await load()
    } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  async function remove(category: Category) {
    if (!window.confirm(`¿Eliminar la categoría «${category.name}»?`)) return
    try { await api.delete(`/categories/${category.id}`); await load() }
    catch (cause) { setError(errorMessage(cause)) }
  }

  return <>
    <PageHeader eyebrow="ORGANIZACIÓN DEL CATÁLOGO" title="Categorías" description="Agrupa los productos con nombres claros para agilizar la búsqueda y el análisis comercial." action={<div className="header-action-group"><Link className="button button-quiet" to="/productos"><ArrowLeft size={15} /> Productos</Link><button className="button button-primary" onClick={() => openForm()}><Plus size={16} /> Nueva categoría</button></div>} />
    {error && <ErrorMessage message={error} />}
    <section className="panel table-panel"><div className="table-toolbar"><div className="table-heading"><div className="table-icon products-icon"><Tags size={18} /></div><div><strong>Clasificación de productos</strong><span>{categories.length} categorías disponibles</span></div></div></div>
      {loading ? <Loading /> : categories.length ? <div className="table-scroll"><table><thead><tr><th>CATEGORÍA</th><th>DESCRIPCIÓN</th><th>PRODUCTOS</th><th>ACCIONES</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td><div className="category-name-cell"><span><FolderOpen size={16} /></span><strong>{category.name}</strong></div></td><td>{category.description || 'Sin descripción'}</td><td><span className="category-chip">Vinculada al catálogo</span></td><td><div className="row-actions"><button className="icon-button" onClick={() => openForm(category)} aria-label={`Editar ${category.name}`}><Pencil size={15} /></button><button className="icon-button danger-action" onClick={() => void remove(category)} aria-label={`Eliminar ${category.name}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No hay categorías" description="Crea una categoría para organizar los productos de tu catálogo." />}
    </section>
    <div className="table-footnote">No es posible eliminar una categoría mientras esté asociada a productos.</div>
    {open && <Modal title={editing ? 'Editar categoría' : 'Nueva categoría'} description="Mantén una clasificación sencilla y fácil de reconocer." onClose={() => { setEditing(null); setForm(blank); setOpen(false) }} onSubmit={save} submitLabel={saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear categoría'}><div className="form-grid"><label className="form-field span-2">Nombre<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} maxLength={100} required placeholder="Ej. Tecnología" /></label><label className="form-field span-2">Descripción<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={255} placeholder="Descripción breve para identificarla" /></label></div></Modal>}
  </>
}
