import { useState } from 'react'
import { Bell, Check, Database, LockKeyhole, Moon, Save, Settings as SettingsIcon, Sun } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../App'

export default function SettingsPage() {
  const { theme, setTheme } = useAuth()
  const [saved, setSaved] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [compactMode, setCompactMode] = useState(false)

  function saveSettings() {
    localStorage.setItem('salesia_settings', JSON.stringify({ notifications, compactMode }))
    setTheme(theme)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2200)
  }

  return <>
    <PageHeader eyebrow="PREFERENCIAS" title="Ajustes" description="Configura las preferencias de tu entorno de trabajo." />
    <div className="settings-layout">
      <section className="panel settings-panel"><div className="settings-panel-heading"><div className="settings-icon"><SettingsIcon size={19} /></div><div><h2>Preferencias de la aplicación</h2><p>Los cambios se guardan en este dispositivo.</p></div></div>
        <div className="settings-row settings-theme-row"><div className="settings-copy"><strong>Modo de apariencia</strong><span>Elige cómo se muestra la interfaz de SalesIA.</span></div><div className="theme-options" role="radiogroup" aria-label="Modo de apariencia"><button className={`theme-option ${theme === 'light' ? 'active' : ''}`} role="radio" aria-checked={theme === 'light'} onClick={() => setTheme('light')}><Sun size={14} /> Claro</button><button className={`theme-option ${theme === 'dark' ? 'active' : ''}`} role="radio" aria-checked={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={14} /> Oscuro</button><button className={`theme-option ${theme === 'system' ? 'active' : ''}`} role="radio" aria-checked={theme === 'system'} onClick={() => setTheme('system')}><Database size={14} /> Predeterminado</button></div></div>
        <div className="settings-row"><div className="settings-copy"><strong>Notificaciones</strong><span>Recibe avisos sobre eventos importantes.</span></div><button className={`toggle ${notifications ? 'active' : ''}`} onClick={() => setNotifications((value) => !value)} aria-label="Alternar notificaciones" aria-pressed={notifications}><i /></button></div>
        <div className="settings-row"><div className="settings-copy"><strong>Modo compacto</strong><span>Muestra más información en las tablas.</span></div><button className={`toggle ${compactMode ? 'active' : ''}`} onClick={() => setCompactMode((value) => !value)} aria-label="Alternar modo compacto" aria-pressed={compactMode}><i /></button></div>
        <div className="settings-row"><div className="settings-copy"><strong>Almacenamiento local</strong><span>Sesión y preferencias se almacenan en el navegador.</span></div><span className="settings-state"><Database size={14} /> Local</span></div>
      </section>
      <aside className="settings-side"><section className="panel settings-security"><div className="settings-icon"><LockKeyhole size={19} /></div><h2>Seguridad</h2><p>La sesión se expira automáticamente cuando el token queda inválido.</p><button className="button button-primary" onClick={saveSettings}>{saved ? <Check size={16} /> : <Save size={16} />}{saved ? 'Guardado' : 'Guardar cambios'}</button></section><section className="panel settings-notice"><Bell size={18} /><div><strong>Preferencias</strong><p>El tema se aplica inmediatamente y se conserva en este dispositivo.</p></div></section></aside>
    </div>
  </>
}
