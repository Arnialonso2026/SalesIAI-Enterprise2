import type { ReactNode } from 'react'

export default function PageHeader({ eyebrow, title, description, action }: {
  eyebrow?: string; title: string; description: string; action?: ReactNode
}) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow ?? 'GESTIÓN COMERCIAL'}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-header-action">{action}</div>}</div>
}
