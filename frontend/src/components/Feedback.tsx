import { AlertCircle, LoaderCircle } from 'lucide-react'

export function Loading({ label = 'Cargando información…' }: { label?: string }) {
  return <div className="feedback-state"><LoaderCircle className="spin" size={24} /><span>{label}</span></div>
}

export function ErrorMessage({ message }: { message: string }) {
  return <div className="error-banner"><AlertCircle size={18} /><span>{message}</span></div>
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><div className="empty-icon"><AlertCircle size={22} /></div><strong>{title}</strong><p>{description}</p></div>
}
