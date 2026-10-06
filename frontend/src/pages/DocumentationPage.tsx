import { ChangeEvent, useEffect, useState } from 'react'
import { BookOpen, FileCheck2, FileText, FolderOpen, Plus, Trash2, Upload, X } from 'lucide-react'
import { api, errorMessage } from '../api'
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import type { Document as DocumentType } from '../types'
import { useRealtimeRefresh } from '../useRealtimeRefresh'
import '../documentation.css'

const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'text/csv', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  return `${(bytes / 1024 ** Math.floor(Math.log(bytes) / Math.log(1024))).toFixed(1)} ${units[Math.floor(Math.log(bytes) / Math.log(1024))]}`
}

export default function DocumentationPage() {
  const [documents, setDocuments] = useState<DocumentType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<DocumentType | null>(null)
  const [saving, setSaving] = useState(false)

  async function loadDocuments() {
    setLoading(true)
    try {
      const { data } = await api.get<DocumentType[]>('/documents')
      setDocuments(data)
      setError('')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadDocuments() }, [])
  useRealtimeRefresh(() => { void loadDocuments() })

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    if (!selected) return
    if (!allowedTypes.includes(selected.type)) {
      setError('El archivo debe ser PDF, Word, Excel, PowerPoint, texto, CSV o una imagen.')
      event.target.value = ''
      return
    }
    if (selected.size > 25 * 1024 * 1024) {
      setError('El archivo no puede superar los 25 MB.')
      event.target.value = ''
      return
    }
    setFile(selected)
    setError('')
  }

  async function confirmUpload() {
    if (!file) return
    if (!window.confirm(`Agregar “${file.name}” a la documentación?`)) return
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setDialogOpen(false)
      setFile(null)
      await loadDocuments()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  async function removeDocument(document: DocumentType) {
    if (!window.confirm(`Eliminar “${document.original_filename}”? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/documents/${document.id}`)
      await loadDocuments()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return <>
    <PageHeader eyebrow="BIBLIOTECA DE ARCHIVOS" title="Documentación" description="Sube, revisa y elimina documentos de trabajo en un único lugar." action={<button className="button button-primary" onClick={() => setDialogOpen(true)}><Plus size={17} /> Agregar documento</button>} />
    {error && <ErrorMessage message={error} />}
    <section className="documents-summary"><div><FolderOpen size={20} /><div><strong>{documents.length} documentos</strong><span>Archivos disponibles para revisión</span></div></div><span className="document-limit">Máximo 25 MB · Formatos permitidos</span></section>
    {loading ? <Loading label="Cargando documentos…" /> : documents.length ? <div className="document-grid">{documents.map((document) => <article className="document-card" key={document.id}><div className="document-file-icon"><FileText size={25} /></div><div className="document-card-copy"><h2>{document.title}</h2><p>{document.original_filename}</p><span>{formatBytes(document.size_bytes)} · {new Date(document.created_at).toLocaleDateString('es-ES')}</span></div><div className="document-actions"><button className="button button-small button-secondary" onClick={() => setPreviewDocument(document)}>Vista previa</button><button className="icon-button danger-action" onClick={() => void removeDocument(document)} aria-label={`Eliminar ${document.original_filename}`}><Trash2 size={15} /></button></div></article>)}</div> : <EmptyState title="Tu biblioteca está vacía" description="Agrega un PDF, documento de Office, texto, CSV o imagen para empezar." />}
    <section className="panel documentation-note"><div><BookOpen size={20} /><div><strong>Guía operativa</strong><p>La documentación oficial también está disponible en la interfaz Swagger del backend.</p></div></div><a className="button button-secondary" href="http://localhost:8000/docs" target="_blank" rel="noreferrer">Abrir documentación</a></section>
    {dialogOpen && <Modal title="Agregar documento" description="Selecciona un archivo de hasta 25 MB. La subida requiere confirmación." onClose={() => setDialogOpen(false)} onSubmit={confirmUpload} submitLabel={saving ? 'Guardando…' : 'Confirmar'}>
      <label className="upload-zone"><input type="file" onChange={selectFile} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp" /><Upload size={28} /><strong>{file ? file.name : 'Selecciona un archivo'}</strong><span>{file ? `${formatBytes(file.size)} · Listo para confirmar` : 'PDF, Word, Excel, PowerPoint, texto, CSV o imagen'}</span></label>
      <div className="upload-note"><FileCheck2 size={16} /><span>El archivo se guarda en el servidor y se asocia a tu empresa.</span></div>
    </Modal>}
    {previewDocument && <div className="preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewDocument(null) }}><div className="preview-card"><div className="preview-header"><div><span>VISTA PREVIA</span><strong>{previewDocument.title}</strong></div><button className="icon-button" onClick={() => setPreviewDocument(null)} aria-label="Cerrar vista previa"><X size={19} /></button></div><iframe title={`Vista previa de ${previewDocument.original_filename}`} src={`/api/v1/documents/${previewDocument.id}/download`} /><div className="preview-actions"><a className="button button-primary" href={`/api/v1/documents/${previewDocument.id}/download`} download={previewDocument.original_filename}>Descargar archivo</a><button className="button button-quiet" onClick={() => setPreviewDocument(null)}>Cerrar</button></div></div></div>}
  </>
}
