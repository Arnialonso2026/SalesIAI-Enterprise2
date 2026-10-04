import type { FormEvent, ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, description, onClose, onSubmit, children, submitLabel = 'Guardar', hideActions = false }: {
  title: string; description: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode; submitLabel?: string; hideActions?: boolean
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form className="modal-card" onSubmit={onSubmit}>
        <div className="modal-heading"><div><h2>{title}</h2><p>{description}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
        <div className="modal-body">{children}</div>
        {!hideActions && <div className="modal-footer"><button type="button" className="button button-quiet" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">{submitLabel}</button></div>}
      </form>
    </div>
  )
}
