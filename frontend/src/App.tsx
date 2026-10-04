import { createContext, lazy, Suspense, useContext, useMemo, useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
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

interface AuthContextValue {
  user: User | null
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
  const { user } = useAuth()
  return user ? <AppLayout><Outlet /></AppLayout> : <Navigate to="/login" replace />
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('salesia_user')
    return saved ? JSON.parse(saved) as User : null
  })

  const auth = useMemo<AuthContextValue>(() => ({
    user,
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
  }), [user])

  return (
    <AuthContext.Provider value={auth}>
      <Suspense fallback={<div className="feedback-state">Cargando módulo…</div>}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/clientes" element={<CustomersPage />} />
            <Route path="/productos" element={<ProductsPage />} />
            <Route path="/categorias" element={<CategoriesPage />} />
            <Route path="/ventas" element={<SalesPage />} />
            <Route path="/ventas/nueva" element={<NewSalePage />} />
            <Route path="/inventario" element={<InventoryPage />} />
          </Route>
          <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
        </Routes>
      </Suspense>
    </AuthContext.Provider>
  )
}
