import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { api } from './api'
import type { User } from './types'
import AppLayout from './components/AppLayout'
import { REALTIME_CHANGE_EVENT } from './useRealtimeRefresh'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CustomersPage = lazy(() => import('./pages/CustomersPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const SalesPage = lazy(() => import('./pages/SalesPage'))
const NewSalePage = lazy(() => import('./pages/NewSalePage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))

interface AuthContextValue {
  user: User | null
  authLoading: boolean
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
  const { user, authLoading } = useAuth()
  if (authLoading) return <div className="feedback-state">Verificando sesión…</div>
  return user ? <AppLayout><Outlet /></AppLayout> : <Navigate to="/login" replace />
}

function AdminLayout() {
  const { user, authLoading } = useAuth()
  if (authLoading) return <div className="feedback-state">Verificando sesión…</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return <AppLayout><Outlet /></AppLayout>
}

function RoleLayout({ allowed }: { allowed: string[] }) {
  const { user, authLoading } = useAuth()
  if (authLoading) return <div className="feedback-state">Verificando sesión…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!allowed.includes(user.role)) return <Navigate to="/" replace />
  return <AppLayout><Outlet /></AppLayout>
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('salesia_user')
    return saved ? JSON.parse(saved) as User : null
  })
  const [authLoading, setAuthLoading] = useState(Boolean(localStorage.getItem('salesia_token')))

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
          const event = JSON.parse(data) as { resource?: string }
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
      socket?.close()
    }
  }, [authLoading, user?.id])

  const auth = useMemo<AuthContextValue>(() => ({
    user,
    authLoading,
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
  }), [user, authLoading])

  return (
    <AuthContext.Provider value={auth}>
      <Suspense fallback={<div className="feedback-state">Cargando módulo…</div>}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/clientes" element={<CustomersPage />} />
            <Route path="/productos" element={<ProductsPage />} />
            <Route path="/ventas" element={<SalesPage />} />
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
            <Route path="/usuarios" element={<UsersPage />} />
          </Route>
          <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
        </Routes>
      </Suspense>
    </AuthContext.Provider>
  )
}
