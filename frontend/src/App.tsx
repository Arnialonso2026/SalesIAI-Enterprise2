import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api } from './api'
import type { User } from './types'
import AppLayout from './components/AppLayout'
import RouteGuard from './components/RouteGuard'
import { REALTIME_CHANGE_EVENT } from './useRealtimeRefresh'
import './theme.css'
import './theme-sync.css'
import './toast.css'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CustomersPage = lazy(() => import('./pages/CustomersPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const PaymentReceiptsPage = lazy(() => import('./pages/PaymentReceiptsPage'))
const AccountsReceivablePage = lazy(() => import('./pages/AccountsReceivablePage'))
const NewSalePage = lazy(() => import('./pages/NewSalePage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const BranchesPage = lazy(() => import('./pages/BranchesPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const AuditPage = lazy(() => import('./pages/AuditPage'))
const DocumentationPage = lazy(() => import('./pages/DocumentationPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))

type ThemeMode = 'light' | 'dark' | 'system'

interface AuthContextValue {
  user: User | null
  authLoading: boolean
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  signIn: (token: string, user: User) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro del proveedor de autenticación.')
  return context
}

function ProtectedLayout() {
  return <AppLayout><RouteGuard /></AppLayout>
}

function AdminLayout() {
  return <AppLayout><RouteGuard allowedRoles={['admin']} /></AppLayout>
}

function RoleLayout({ allowed }: { allowed: User['role'][] }) {
  return <AppLayout><RouteGuard allowedRoles={allowed} /></AppLayout>
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('salesia_user')
    return saved ? JSON.parse(saved) as User : null
  })
  const [authLoading, setAuthLoading] = useState(Boolean(localStorage.getItem('salesia_token')))
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('salesia_theme') as ThemeMode | null
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  })
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      document.documentElement.dataset.theme = theme === 'system'
        ? (mediaQuery.matches ? 'dark' : 'light')
        : theme
    }

    applyTheme()
    if (theme === 'system') mediaQuery.addEventListener('change', applyTheme)
    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [theme])

  useEffect(() => {
    let active = true
    const token = localStorage.getItem('salesia_token')
    if (!token) { setAuthLoading(false); return () => { active = false } }
    void api.get<User>('/auth/me')
      .then(({ data }) => {
        if (active) { localStorage.setItem('salesia_user', JSON.stringify(data)); setUser(data) }
      })
      .catch(() => {
        if (active) { localStorage.removeItem('salesia_token'); localStorage.removeItem('salesia_user'); setUser(null) }
      })
      .finally(() => { if (active) setAuthLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    const token = localStorage.getItem('salesia_token')
    if (!token) return

    let active = true
    let retryDelay = 1000
    let retryTimer = 0
    let hasConnected = false
    let socket: WebSocket | null = null

    const showToast = (event: { resource?: string; operation?: string; status_code?: number }) => {
      if (event.resource === undefined || event.operation === undefined || event.status_code === undefined) return
      const resourceLabels: Record<string, string> = {
        users: 'Usuarios', customers: 'Clientes', products: 'Productos', categories: 'Categorías',
        sales: 'Ventas',
        inventory: 'Inventario', documents: 'Documentación', audit: 'Auditoría',
        analytics: 'Analítica', dashboard: 'Panel', branches: 'Sucursales',
      }
      const operationLabels: Record<string, string> = {
        post: 'se agregó', put: 'se actualizó', patch: 'se modificó', delete: 'se eliminó',
      }
      const resource = resourceLabels[event.resource] ?? event.resource
      const operation = operationLabels[event.operation] ?? 'se modificó'
      setToast({ id: Date.now(), message: `${resource} ${operation}.` })
      window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(null), 5000)
    }

    const connect = () => {
      const socketUrl = new URL(import.meta.env.VITE_API_URL ?? '/api/v1', window.location.origin)
      socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:'
      socketUrl.pathname = `${socketUrl.pathname.replace(/\/$/, '')}/realtime/ws`
      socket = new WebSocket(socketUrl, ['salesia', `bearer.${token}`])
      socket.onopen = () => {
        retryDelay = 1000
        if (hasConnected) {
          window.dispatchEvent(new CustomEvent(REALTIME_CHANGE_EVENT, { detail: { type: 'resync' } }))
        }
        hasConnected = true
      }
      socket.onmessage = ({ data }) => {
        try {
          const event = JSON.parse(data) as { type?: string; resource?: string; operation?: string; status_code?: number }
          if (event.resource === 'users') {
            void api.get<User>('/auth/me')
              .then(({ data: currentUser }) => {
                localStorage.setItem('salesia_user', JSON.stringify(currentUser))
                setUser(currentUser)
              })
              .catch(() => {
                localStorage.removeItem('salesia_token')
                localStorage.removeItem('salesia_user')
                setUser(null)
              })
          }
          if (event.type === 'data_changed') showToast(event)
          window.dispatchEvent(new CustomEvent(REALTIME_CHANGE_EVENT, { detail: event }))
        } catch {
          return
        }
      }
      socket.onerror = () => socket?.close()
      socket.onclose = (event) => {
        if (!active) return
        if (event.code === 4401) {
          localStorage.removeItem('salesia_token')
          localStorage.removeItem('salesia_user')
          setUser(null)
          return
        }
        if (event.code === 4403) return
        retryTimer = window.setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 2, 30000)
      }
    }

    connect()
    return () => {
      active = false
      window.clearTimeout(retryTimer)
      window.clearTimeout(toastTimer.current)
      socket?.close()
    }
  }, [authLoading, user?.id])

  const auth = useMemo<AuthContextValue>(() => ({
    user,
    authLoading,
    theme,
    setTheme: (nextTheme) => {
      localStorage.setItem('salesia_theme', nextTheme)
      setTheme(nextTheme)
    },
    signIn: (token, nextUser) => {
      localStorage.setItem('salesia_token', token)
      localStorage.setItem('salesia_user', JSON.stringify(nextUser))
      setUser(nextUser)
    },
    signOut: () => {
      localStorage.removeItem('salesia_token')
      localStorage.removeItem('salesia_user')
      setUser(null)
    },
  }), [user, authLoading, theme])

  return (
    <AuthContext.Provider value={auth}>
      {toast && <div className="server-toast" role="status" aria-live="polite" key={toast.id}>{toast.message}</div>}
      <Suspense fallback={<div className="feedback-state">Cargando módulo…</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/clientes" element={<CustomersPage />} />
            <Route path="/productos" element={<ProductsPage />} />
            <Route path="/ventas" element={<Navigate to="/cuentas-cobrar" replace />} />
            <Route path="/comprobantes-pago" element={<PaymentReceiptsPage />} />
            <Route path="/cuentas-cobrar" element={<AccountsReceivablePage />} />
            <Route path="/inventario" element={<InventoryPage />} />
          </Route>
          <Route element={<RoleLayout allowed={['admin', 'manager', 'analyst']} />}>
            <Route path="/analitica" element={<AnalyticsPage />} />
          </Route>
          <Route element={<RoleLayout allowed={['admin', 'seller']} />}>
            <Route path="/ventas/nueva" element={<NewSalePage />} />
          </Route>
          <Route element={<RoleLayout allowed={['admin', 'warehouse']} />}>
            <Route path="/categorias" element={<CategoriesPage />} />
          </Route>
          <Route element={<AdminLayout />}>
            <Route path="/sucursales" element={<BranchesPage />} />
            <Route path="/usuarios" element={<UsersPage />} />
            <Route path="/usuarios/auditoria" element={<AuditPage />} />
            <Route path="/usuarios/documentacion" element={<DocumentationPage />} />
          </Route>
          <Route path="/ajustes" element={<RoleLayout allowed={['admin', 'manager', 'seller', 'warehouse', 'analyst']} />}>
            <Route index element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </Suspense>
    </AuthContext.Provider>
  )
}
