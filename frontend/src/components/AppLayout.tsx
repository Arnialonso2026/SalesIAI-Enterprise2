import { NavLink, useLocation } from 'react-router-dom'
import { BarChart3, Box, CircleDollarSign, ClipboardList, LayoutDashboard, LogOut, PackageSearch, Tags, UserRoundCog, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../App'

const navigation = [
  { label: 'Resumen', path: '/', icon: LayoutDashboard },
  { label: 'Ventas', path: '/ventas', icon: CircleDollarSign },
  { label: 'Clientes', path: '/clientes', icon: Users },
  { label: 'Productos', path: '/productos', icon: Box },
  { label: 'Categorías', path: '/categorias', icon: Tags, allowedRoles: ['admin', 'warehouse'] },
  { label: 'Inventario', path: '/inventario', icon: PackageSearch },
  { label: 'Usuarios', path: '/usuarios', icon: UserRoundCog, adminOnly: true },
]

const titles: Record<string, string> = {
  '/': 'Resumen ejecutivo', '/ventas': 'Ventas', '/ventas/nueva': 'Nueva venta', '/categorias': 'Categorías',
  '/clientes': 'Clientes', '/productos': 'Productos', '/inventario': 'Inventario', '/usuarios': 'Usuarios',
}
const roleLabels: Record<string, string> = {
  admin: 'Administrador', seller: 'Vendedor', manager: 'Gerencia', warehouse: 'Almacén', analyst: 'Analista',
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const visibleNavigation = navigation.filter((item) =>
    (!item.adminOnly || user?.role === 'admin') && (!item.allowedRoles || item.allowedRoles.includes(user?.role ?? '')),
  )
  const initials = user?.full_name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase() ?? 'SA'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><BarChart3 size={22} strokeWidth={2.6} /></div>
          <div><strong>salesia<span>.</span></strong><small>ENTERPRISE</small></div>
        </div>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <div className="workspace-card"><div className="workspace-avatar">M</div><div><strong>Matrixflow Demo</strong><small>Plan empresarial</small></div><span className="workspace-dot" /></div>
        <div className="nav-caption">MENÚ PRINCIPAL</div>
        <nav className="sidebar-nav">
          {visibleNavigation.map(({ label, path, icon: Icon }) => (
            <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
              {label === 'Inventario' && <span className="nav-tag">STOCK</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-help"><div className="help-icon"><ClipboardList size={19} /></div><strong>¿Necesitas ayuda?</strong><p>Consulta la documentación para aprovechar SalesIA.</p><a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">Abrir guía <span>↗</span></a></div>
        <div className="sidebar-footer"><div className="user-avatar">{initials}</div><div className="user-meta"><strong>{user?.full_name}</strong><small>{user?.role ? roleLabels[user.role] ?? user.role : 'Usuario'}</small></div><button className="icon-button logout-button" aria-label="Cerrar sesión" onClick={signOut}><LogOut size={17} /></button></div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>SalesIA</span><span className="crumb-slash">/</span><strong>{titles[pathname] ?? 'Panel'}</strong></div>
          <div className="topbar-actions"><span className="live-status"><i /> Sistema operativo</span><div className="topbar-divider" /><div className="topbar-user"><span className="topbar-avatar">{initials}</span><span>{user?.full_name.split(' ')[0]}</span></div></div>
        </header>
        <section className="page-content">{children}</section>
      </main>
    </div>
  )
}
