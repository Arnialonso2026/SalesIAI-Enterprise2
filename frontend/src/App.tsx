import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { api } from './api'
import type { User } from './types'
import AppLayout from './components/AppLayout'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CustomersPage = lazy(() => import('./pages/CustomersPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const SalesPage = lazy(() => import('./pages/SalesPage'))
const NewSalePage = lazy(() => import('./pages/NewSalePage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))

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
