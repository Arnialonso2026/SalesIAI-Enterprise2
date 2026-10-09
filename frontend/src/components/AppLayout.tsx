import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Box, CircleDollarSign, ClipboardList, FileText, LayoutDashboard, LogOut, Moon, PackageSearch, Settings, ShieldCheck, Sun, Tags, UserRoundCog, Users } from 'lucide-react'
import { useAuth } from '../App'
import './navigation.css'

type NavigationItem = {
  label: string
  path: string
  icon: typeof LayoutDashboard
  allowedRoles?: string[]
  adminOnly?: boolean
}

type NavigationGroup = {
  label: string
  items: NavigationItem[]
}

const navigation: NavigationGroup[] = [
  { label: 'Ejecutivo', items: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  ] },
  { label: 'Operaciones', items: [
    { label: 'Ventas', path: '/ventas', icon: CircleDollarSign },
    { label: 'Inventario y Stock', path: '/inventario', icon: PackageSearch },
  ] },
  { label: 'Analítica e IA', items: [
    { label: 'Analítica', path: '/analitica', icon: BarChart3, allowedRoles: ['admin', 'manager', 'analyst'] },
  ] },
  { label: 'Mantenimiento', items: [
    { label: 'Clientes', path: '/clientes', icon: Users },
    { label: 'Productos', path: '/productos', icon: Box },
    { label: 'Categorías', path: '/categorias', icon: Tags, allowedRoles: ['admin', 'warehouse'] },
  ] },
  { label: 'Administración', items: [
    { label: 'Auditoría', path: '/usuarios/auditoria', icon: ShieldCheck, adminOnly: true },
    { label: 'Usuarios', path: '/usuarios', icon: UserRoundCog, adminOnly: true },
    { label: 'Documentación', path: '/usuarios/documentacion', icon: FileText, adminOnly: true },
  ] },
]

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard', '/ventas': 'Ventas', '/ventas/nueva': 'Nueva venta', '/categorias': 'Categorías', '/analitica': 'Analítica',
  '/clientes': 'Clientes', '/productos': 'Productos', '/inventario': 'Inventario', '/usuarios': 'Usuarios',
  '/usuarios/auditoria': 'Auditoría', '/usuarios/documentacion': 'Documentación', '/ajustes': 'Ajustes',
}
const roleLabels: Record<string, string> = {
  admin: 'Administrador', seller: 'Vendedor', manager: 'Gerencia', warehouse: 'Almacén', analyst: 'Analista',
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut, setTheme } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const visibleNavigation = navigation.map((group) => ({
    ...group,
    items: group.items.flatMap((item) => {
      const visible = (!item.adminOnly || user?.role === 'admin')
        && (!item.allowedRoles || item.allowedRoles.includes(user?.role ?? ''))
      if (!visible) return []
      return [item]
    }),
  })).filter((group) => group.items.length > 0)
  const initials = user?.full_name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase() ?? 'SA'
  const isDarkTheme = document.documentElement.dataset.theme === 'dark'

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  function openSettings() {
    setMenuOpen(false)
    navigate('/ajustes')
  }

  function handleSignOut() {
    setMenuOpen(false)
    signOut()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><BarChart3 size={22} strokeWidth={2.6} /></div>
          <div><strong>salesia<span>.</span></strong><small>ENTERPRISE</small></div>
        </div>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <div className="workspace-card"><div className="workspace-avatar">M</div><div><strong>SalesIA Enterprise</strong><small>Plan empresarial</small></div><span className="workspace-dot" /></div>
        <div className="nav-caption">MENÚ PRINCIPAL</div>
        <nav className="sidebar-nav">
          {visibleNavigation.map(({ label: groupLabel, items }) => (
            <section className={`nav-section${items.some(({ path }) => pathname === path || pathname.startsWith(`${path}/`)) ? ' is-active' : ''}`} key={groupLabel}>
              <h2 className="nav-section-title">{groupLabel}</h2>
              <div className="nav-section-links">
                {items.map(({ label, path, icon: Icon }) => (
                  <div className="nav-item" key={path}>
                    <NavLink to={path} end={path !== '/ventas'} title={label} aria-label={label} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                      <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
                    </NavLink>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-help"><div className="help-icon"><ClipboardList size={19} /></div><strong>¿Necesitas ayuda?</strong><p>Consulta la documentación para aprovechar SalesIA.</p><a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">Abrir guía <span>↗</span></a></div>
        <div className="sidebar-footer" ref={menuRef}>
          <button className="user-menu-trigger" aria-label="Abrir menú de usuario" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <span className="user-avatar">{initials}</span><span className="user-meta"><strong>{user?.full_name}</strong><small>{user?.role ? roleLabels[user.role] ?? user.role : 'Usuario'}</small></span><span className="menu-chevron">⌄</span>
          </button>
          {menuOpen && <div className={`user-menu${menuOpen ? ' open' : ''}`} role="menu"><button role="menuitem" onClick={openSettings}><Settings size={16} /> Ajustes</button><button role="menuitem" className="user-menu-signout" onClick={handleSignOut}><LogOut size={16} /> Cerrar sesión</button></div>}
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>SalesIA</span><span className="crumb-slash">/</span><strong>{titles[pathname] ?? 'Panel'}</strong></div>
          <div className="topbar-actions"><span className="live-status"><i /> Sistema operativo</span><div className="topbar-divider" /><button className="theme-toggle" type="button" aria-label={`Cambiar a tema ${isDarkTheme ? 'claro' : 'oscuro'}`} title={`Cambiar a tema ${isDarkTheme ? 'claro' : 'oscuro'}`} onClick={() => setTheme(isDarkTheme ? 'light' : 'dark')}>{isDarkTheme ? <Sun size={17} /> : <Moon size={17} />}</button><div className="topbar-user"><span className="topbar-avatar">{initials}</span><span>{user?.full_name.split(' ')[0]}</span></div></div>
        </header>
        <section className="page-content">{children}</section>
      </main>
    </div>
  )
}
