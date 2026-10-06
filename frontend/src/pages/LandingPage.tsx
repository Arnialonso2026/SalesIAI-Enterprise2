import { ArrowRight, BarChart3, Boxes, CheckCircle2, CircleDollarSign, FileText, Menu, PackageCheck, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import './landing.css'

const features = [
  { icon: CircleDollarSign, title: 'Ventas integradas', text: 'Registra operaciones, calcula el total y mantén el historial comercial en un solo flujo.' },
  { icon: Boxes, title: 'Inventario en tiempo real', text: 'Controla stock, movimientos y alertas para evitar shortages o excesiones.' },
  { icon: BarChart3, title: 'Analítica clara', text: 'Visualiza tendencias,Insights y reportes para tomar decisiones con mayor confianza.' },
  { icon: Users, title: 'Gestion de personas', text: 'Administra usuarios, roles, credenciales y permisos desde un espacio seguro.' },
  { icon: ShieldCheck, title: 'Auditoría y seguridad', text: 'Registra acciones, sesiones y cambios importantes con trazabilidad completa.' },
  { icon: FileText, title: 'Documentación corporativa', text: 'Organiza archivos y procedimientos en un repositorio accesible por rol.' },
]

const sections = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'funcionalidades', label: 'Funcionalidades' },
  { id: 'proceso', label: 'Proceso' },
  { id: 'seguridad', label: 'Seguridad' },
]

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="#inicio" aria-label="SalesIA Enterprise, inicio">
          <span className="brand-mark"><BarChart3 size={22} /></span>
          <span><strong>salesia<span>.</span></strong><small>ENTERPRISE</small></span>
        </a>
        <nav className={`landing-nav${menuOpen ? ' open' : ''}`} aria-label="Navegación principal">
          {sections.map(section => <a key={section.id} href={`#${section.id}`} onClick={() => setMenuOpen(false)}>{section.label}</a>)}
          <Link className="button button-primary landing-login" to="/login">Iniciar sesión <ArrowRight size={16} /></Link>
        </nav>
        <button className="landing-menu" type="button" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(value => !value)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />
          <div className="hero-copy">
            <div className="hero-kicker"><Sparkles size={14} /> PLATAFORMA DE GESTIÓN COMERCIAL</div>
            <h1>Tu operación.<br /><em>En una sola visión.</em></h1>
            <p>SalesIA Enterprise conecta ventas, inventario, clientes y decisiones para que tu equipo pueda trabajar con mayor claridad y control.</p>
            <div className="hero-actions">
              <Link className="button button-primary button-large" to="/login">Iniciar sesión <ArrowRight size={18} /></Link>
              <a className="button button-secondary button-large" href="#funcionalidades">Explorar funciones</a>
            </div>
            <div className="hero-proof"><span><CheckCircle2 size={15} /> Gestión segura por rol</span><span><CheckCircle2 size={15} /> Datos actualizados</span><span><CheckCircle2 size={15} /> Auditoría trazable</span></div>
          </div>
          <div className="hero-dashboard-preview" aria-label="Vista previa del panel de control">
            <div className="preview-top"><div><span className="preview-logo"><BarChart3 size={15} /></span><div><strong>Resumen ejecutivo</strong><small>SalesIA Enterprise</small></div></div><span className="preview-live"><i /> En línea</span></div>
            <div className="preview-metrics"><div><span>Ingresos del mes</span><strong>S/ 84,200</strong><small>+18.4%</small></div><div><span>Ventas hoy</span><strong>24</strong><small>+3.2%</small></div><div><span>Clientes</span><strong>1,284</strong><small>+8.1%</small></div></div>
            <div className="preview-chart"><div className="preview-chart-head"><span>Ventas recientes</span><strong>7 días</strong></div><div className="preview-bars"><i style={{ height: '35%' }} /><i style={{ height: '48%' }} /><i style={{ height: '42%' }} /><i style={{ height: '68%' }} /><i style={{ height: '56%' }} /><i style={{ height: '82%' }} /><i style={{ height: '94%' }} /></div></div>
            <div className="preview-activity"><span>Actividad reciente</span><div><i><PackageCheck size={15} /></i><p><strong>Venta #SA-1048</strong><small>Completa</small></p><b>S/ 8,240</b></div></div>
          </div>
        </section>

        <section className="section features-section" id="funcionalidades">
          <div className="section-heading"><span className="eyebrow">TODO EN UN SOLO LUGAR</span><h2>Funciones que hacen crecer<br />a tu operación.</h2><p>Un sistema diseñado para que tu equipo pueda administrar el negocio con rapidez, precisión y seguridad.</p></div>
          <div className="feature-grid">{features.map(({ icon: Icon, title, text }) => <article className="feature-card" key={title}><span className="feature-icon"><Icon size={22} /></span><h3>{title}</h3><p>{text}</p><a href="#proceso">Ver cómo funciona <ArrowRight size={14} /></a></article>)}</div>
        </section>

        <section className="section workflow-section" id="proceso">
          <div className="workflow-copy"><span className="eyebrow">FLUJO DE TRABAJO</span><h2>Menos pasos.<br />Más decisiones.</h2><p>Desde la entrada de una venta hasta el análisis final, cada operación se conecta a la información correcta.</p><div className="workflow-list"><div><span>01</span><p><strong>Registra</strong> clientes, productos y movimientos.</p></div><div><span>02</span><p><strong>Gestiona</strong> ventas e inventario en tiempo real.</p></div><div><span>03</span><p><strong>Analiza</strong> resultados y actúa con confianza.</p></div></div></div>
          <div className="workflow-panel"><div className="workflow-panel-top"><span>OPERACIÓN COMERCIAL</span><span className="workflow-status"><i /> Activa</span></div><div className="workflow-row"><span className="workflow-icon"><CircleDollarSign size={20} /></span><div><small>Venta registrada</small><strong>SA-1048</strong></div><b>S/ 8,240</b></div><div className="workflow-row"><span className="workflow-icon purple"><Boxes size={20} /></span><div><small>Inventario actualizado</small><strong>3 productos</strong></div><b>OK</b></div><div className="workflow-row"><span className="workflow-icon green"><BarChart3 size={20} /></span><div><small>Indicador actualizado</small><strong>Ingresos del mes</strong></div><b>+18.4%</b></div></div>
        </section>

        <section className="section security-section" id="seguridad">
          <div className="security-card"><div className="security-icon"><ShieldCheck size={30} /></div><div><span className="eyebrow">SEGURIDAD POR DISEÑO</span><h2>Tu información, protegida<br />y trazable.</h2><p>Acceso por roles, autenticación segura, auditoría de acciones y control de sesiones forman la base de cada operación.</p></div><div className="security-points"><span><CheckCircle2 size={17} /> Autenticación con credenciales</span><span><CheckCircle2 size={17} /> Permisos por rol</span><span><CheckCircle2 size={17} /> Registro de auditoría</span></div></div>
        </section>

        <section className="final-cta"><div><span className="eyebrow">LISTA PARA EMPEZAR</span><h2>Transforma la información<br />en decisiones comerciales.</h2><p>Inicia sesión con las credenciales asignadas por tu administrador.</p></div><Link className="button button-light button-large" to="/login">Iniciar sesión <ArrowRight size={18} /></Link></section>
      </main>

      <footer className="landing-footer"><a className="landing-brand" href="#inicio"><span className="brand-mark"><BarChart3 size={20} /></span><span><strong>salesia<span>.</span></strong><small>ENTERPRISE</small></span></a><p>Plataforma de gestión comercial • Proyecto académico SENATI</p><span>© 2026 SalesIA Enterprise</span></footer>
    </div>
  )
}
