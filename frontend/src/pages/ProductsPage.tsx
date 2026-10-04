import { FormEvent, useEffect, useState } from 'react'
import { Search, Plus, Box, Pencil, Trash2, PackageCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../App'
import type { Category, Product } from '../types'
import { currency } from '../utils'

const blank = { sku: '', name: '', description: '', category_id: '', price: '', stock: '0', min_stock: '5' }

export default function ProductsPage() {
  const { user } = useAuth()
  const canManageCatalog = user?.role === 'admin' || user?.role === 'warehouse'
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  async function loadProducts(term = search) {
    setLoading(true)
    try { const { data } = await api.get<Product[]>('/products', { params: { search: term } }); setProducts(data); setError('') }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void Promise.all([loadProducts(''), api.get<Category[]>('/categories').then(({ data }) => setCategories(data))]).catch((cause: unknown) => setError(errorMessage(cause))) }, [])

  function editProduct(product: Product) {
    setEditingProduct(product)
    setForm({ sku: product.sku, name: product.name, description: product.description ?? '', category_id: product.category_id ? String(product.category_id) : '', price: String(product.price), stock: String(product.stock), min_stock: String(product.min_stock) })
    setOpen(true)
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const payload = { sku: form.sku, name: form.name, description: form.description || null, category_id: form.category_id ? Number(form.category_id) : null, price: Number(form.price), stock: Number(form.stock), min_stock: Number(form.min_stock) }
      if (editingProduct) await api.put(`/products/${editingProduct.id}`, payload)
      else await api.post('/products', payload)
      setOpen(false); setEditingProduct(null); setForm(blank); await loadProducts()
    } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  async function deactivateProduct(product: Product) {
    if (!window.confirm(`¿Desactivar ${product.name}? Se conservarán los movimientos y ventas anteriores.`)) return
    try { await api.delete(`/products/${product.id}`); await loadProducts() }
    catch (cause) { setError(errorMessage(cause)) }
  }

  return <>
    <PageHeader eyebrow="CATÁLOGO COMERCIAL" title="Productos" description="Administra tu catálogo, precios y niveles de existencias en un mismo lugar." action={<div className="header-action-group"><a className="button button-quiet" href="/categorias">Categorías</a><button className="button button-primary" onClick={() => { setEditingProduct(null); setForm(blank); setOpen(true) }}><Plus size={17} /> Nuevo producto</button></div>} />
      <PageHeader eyebrow="CATÁLOGO COMERCIAL" title="Productos" description="Administra tu catálogo, precios y niveles de existencias en un mismo lugar." action={canManageCatalog && <div className="header-action-group"><Link className="button button-quiet" to="/categorias">Categorías</Link><button className="button button-primary" onClick={() => { setEditingProduct(null); setForm(blank); setOpen(true) }}><Plus size={17} /> Nuevo producto</button></div>} />
    {error && <ErrorMessage message={error} />}
    <section className="panel table-panel"><div className="table-toolbar"><div className="table-heading"><div className="table-icon products-icon"><Box size={18} /></div><div><strong>Catálogo de productos</strong><span>{products.length} productos disponibles</span></div></div><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); void loadProducts(event.target.value) }} placeholder="Buscar por nombre o SKU…" /></label></div>
      {loading ? <Loading /> : products.length ? <div className="table-scroll"><table><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>SKU</th><th>PRECIO</th><th>EXISTENCIAS</th><th>ESTADO</th>{canManageCatalog && <th>ACCIONES</th>}</tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="product-cell"><span className="product-avatar"><PackageCheck size={17} /></span><div><strong>{product.name}</strong><small>{product.description || 'Sin descripción'}</small></div></div></td><td><span className="category-chip">{product.category?.name || 'Sin categoría'}</span></td><td><span className="document-code">{product.sku}</span></td><td><strong className="price-value">{currency(product.price)}</strong></td><td><div className="stock-indicator"><span className={product.stock <= product.min_stock ? 'stock-dot low' : 'stock-dot'} />{product.stock} unidades</div></td><td><span className={`status-pill ${product.stock <= product.min_stock ? 'status-low' : 'status-active'}`}>{product.stock <= product.min_stock ? 'Stock bajo' : 'Disponible'}</span></td>{canManageCatalog && <td><div className="row-actions"><button className="icon-button" onClick={() => editProduct(product)} aria-label={`Editar ${product.name}`}><Pencil size={15} /></button><button className="icon-button danger-action" onClick={() => void deactivateProduct(product)} aria-label={`Desactivar ${product.name}`}><Trash2 size={15} /></button></div></td>}</tr>)}</tbody></table></div> : <EmptyState title="Catálogo vacío" description="Crea tu primer producto para empezar a gestionar ventas e inventario." />}
    </section>
    <div className="table-footnote">El stock se ajusta desde Inventario para conservar su historial de movimientos.</div>
    {open && <Modal title={editingProduct ? 'Editar producto' : 'Nuevo producto'} description={editingProduct ? 'Actualiza la ficha del producto; el stock se modifica desde Inventario.' : 'Registra un artículo en el catálogo de tu empresa.'} onClose={() => { setOpen(false); setEditingProduct(null) }} onSubmit={saveProduct} submitLabel={saving ? 'Guardando…' : editingProduct ? 'Guardar cambios' : 'Guardar producto'}><div className="form-grid"><label className="form-field">Nombre del producto<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} required /></label><label className="form-field">SKU<input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} minLength={2} required placeholder="TEC-001" /></label><label className="form-field">Categoría<select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}><option value="">Sin categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="form-field">Precio (S/)<input type="number" min="0.01" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label><label className="form-field">{editingProduct ? 'Stock actual' : 'Stock inicial'}<input type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} required disabled={Boolean(editingProduct)} /></label><label className="form-field">Stock mínimo<input type="number" min="0" step="1" value={form.min_stock} onChange={(event) => setForm({ ...form, min_stock: event.target.value })} required /></label><label className="form-field span-2">Descripción<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Descripción breve del producto" /></label></div></Modal>}
  </>
}
