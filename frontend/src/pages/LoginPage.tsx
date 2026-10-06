import { FormEvent, useState } from 'react'
import { ArrowRight, BarChart3, Check, LockKeyhole, ScanFace } from 'lucide-react'
import { api, errorMessage } from '../api'
import { useAuth } from '../App'
import type { User } from '../types'

interface LoginResponse { access_token: string; token_type: string; user: User }

export default function LoginPage() {
  const { signIn } = useAuth()
  const [dni, setDni] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { dni, password })
      signIn(data.access_token, data.user)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <section className="login-story">
        <div className="login-brand"><div className="brand-mark"><BarChart3 size={22} /></div><div><strong>salesia<span>.</span></strong><small>ENTERPRISE</small></div></div>
        <div className="story-content"><div className="story-pill"><span /> GESTIÓN INTELIGENTE DE VENTAS</div><h1>De cada venta,<br /><em>una mejor decisión.</em></h1><p>Gestiona tu operación comercial en un solo lugar y convierte cada dato en una oportunidad de crecimiento.</p><div className="story-benefits"><div><span><Check size={14} /></span> Operación comercial conectada</div><div><span><Check size={14} /></span> Inventario siempre bajo control</div><div><span><Check size={14} /></span> Información lista para analizar</div></div></div>
        <div className="story-foot"><span>SALESIA ENTERPRISE</span><span>PLATAFORMA DE GESTIÓN COMERCIAL</span></div>
        <div className="story-orb orb-one" /><div className="story-orb orb-two" />
      </section>
      <section className="login-panel"><div className="login-form-wrap"><div className="login-welcome"><div className="login-mobile-brand"><div className="brand-mark"><BarChart3 size={22} /></div><strong>salesia<span>.</span></strong></div><span className="eyebrow">BIENVENIDO DE NUEVO</span><h2>Inicia sesión</h2><p>Ingresa tu DNI y contraseña asignados por el administrador.</p></div>
        <form className="login-form" onSubmit={submit}>
          <label htmlFor="dni">DNI</label><div className="input-with-icon"><ScanFace size={17} /><input id="dni" type="text" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={dni} onChange={(event) => setDni(event.target.value.replace(/\D/g, '').slice(0, 8))} autoComplete="username" placeholder="8 dígitos" required /></div>
          <div className="password-label"><label htmlFor="password">Contraseña</label><span>Acceso seguro</span></div><div className="input-with-icon"><LockKeyhole size={17} /><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div>
          {error && <div className="login-error">{error}</div>}
          <button className="button button-primary login-submit" disabled={loading}>{loading ? 'Ingresando…' : <>Entrar a mi espacio <ArrowRight size={17} /></>}</button>
        </form>
        <div className="login-copyright">© 2026 SalesIA Enterprise <span>•</span> Proyecto académico SENATI</div>
      </div></section>
    </div>
  )
}
