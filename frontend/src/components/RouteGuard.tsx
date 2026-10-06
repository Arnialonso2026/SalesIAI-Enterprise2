import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import type { User } from '../types'

interface RouteGuardProps {
  allowedRoles?: User['role'][]
}

export default function RouteGuard({ allowedRoles }: RouteGuardProps) {
  const { user, authLoading } = useAuth()
  const location = useLocation()

  if (authLoading) {
    return <div className="feedback-state">Verificando sesión…</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return <Outlet />
}
