import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import './App.css'

// Datos base para Perú
const SERVICIOS_PERU = [
  { nombre: 'Netflix Premium', precio: 55 },
  { nombre: 'Netflix Estándar', precio: 35 },
  { nombre: 'Netflix Básico', precio: 25 },
  { nombre: 'Spotify Duo', precio: 18 },
  { nombre: 'Spotify Family', precio: 25 },
  { nombre: 'Disney+', precio: 30 },
  { nombre: 'HBO Max', precio: 28 },
  { nombre: 'Amazon Prime', precio: 20 },
  { nombre: 'YouTube Premium', precio: 22 },
  { nombre: 'Crunchyroll', precio: 18 },
]

const formatPEN = (amount) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount)

const formatFecha = (dateStr) => {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

const hoy = () => new Date().toISOString().split('T')[0]

function App() {
  const [session, setSession] = useState(null)
  const [loadingSession, setLoadingSession] = useState(true)
  
  // Estados de Login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)

  const [clients, setClients] = useState([])
  const [status, setStatus] = useState({ ready: false, qr: null })
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showRenewModal, setShowRenewModal] = useState(null)
  
  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  
  const [newClient, setNewClient] = useState({ name: '', phone: '+51', service: '', precio: '', dueDate: '', dni: '' })
  const [editingClient, setEditingClient] = useState(null)
  const [renewData, setRenewData] = useState({ metodo: 'Yape' })

  // Verificar sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoadingSession(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Cargar clientes
  useEffect(() => {
    if (session) fetchClients()
  }, [session])

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('vencimiento', { ascending: true })
    
    if (error) console.error("Error cargando clientes:", error)
    else setClients(data.map(c => ({
      id: c.id, name: c.nombre, phone: c.telefono, service: c.servicio, 
      precio: Number(c.precio), dueDate: c.vencimiento, status: c.estado, dni: c.dni
    })))
  }

  // Auth Handlers
  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthError('')
    if (isRegistering) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setAuthError(error.message)
      else alert('¡Registro exitoso! Revisa tu correo (si está habilitado) o inicia sesión.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setAuthError('Correo o contraseña incorrectos.')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // Cálculos de estadísticas
  const ingresosTotal = clients.reduce((acc, c) => acc + (c.precio || 0), 0)
  const vencidosCount = clients.filter(c => c.status === 'expired').length
  const porVencerCount = clients.filter(c => c.status === 'warning').length
  const alDiaCount = clients.filter(c => c.status === 'active').length

  const clientesFiltrados = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    c.service.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAddClient = async (e) => {
    e.preventDefault()
    const date = new Date(newClient.dueDate)
    const today = new Date()
    let st = 'active'
    if (date < today) st = 'expired'
    else if (date.getTime() - today.getTime() < 3 * 24 * 60 * 60 * 1000) st = 'warning'
    
    const { data, error } = await supabase.from('clientes').insert([{
      user_id: session.user.id,
      nombre: newClient.name,
      telefono: newClient.phone,
      servicio: newClient.service,
      precio: Number(newClient.precio),
      vencimiento: newClient.dueDate,
      estado: st,
      dni: newClient.dni
    }])

    if (!error) {
      setNewClient({ name: '', phone: '+51', service: '', precio: '', dueDate: '', dni: '' })
      setShowAddModal(false)
      fetchClients()
    } else {
      alert("Error al guardar: " + error.message)
    }
  }

  const handleEditClient = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('clientes').update({
      nombre: editingClient.name,
      telefono: editingClient.phone,
      servicio: editingClient.service,
      precio: Number(editingClient.precio),
      vencimiento: editingClient.dueDate,
      dni: editingClient.dni
    }).eq('id', editingClient.id)

    if (!error) {
      setShowEditModal(false)
      fetchClients()
    }
  }

  const handleDelete = async (id) => {
    await supabase.from('clientes').delete().eq('id', id)
    setShowDeleteConfirm(null)
    fetchClients()
  }

  const handleRenew = async (e) => {
    e.preventDefault()
    const client = clients.find(c => c.id === showRenewModal)
    
    // Sumar 1 mes a la fecha de vencimiento actual (o desde hoy si ya venció hace mucho)
    const currentDueDate = new Date(client.dueDate)
    const today = new Date()
    const baseDate = currentDueDate < today ? today : currentDueDate
    baseDate.setMonth(baseDate.getMonth() + 1)
    const newDateStr = baseDate.toISOString().split('T')[0]

    // Actualizar cliente
    await supabase.from('clientes').update({
      vencimiento: newDateStr,
      estado: 'active'
    }).eq('id', client.id)

    // Insertar pago
    await supabase.from('pagos').insert([{
      cliente_id: client.id,
      monto: client.precio,
      metodo: renewData.metodo
    }])

    setShowRenewModal(null)
    fetchClients()
    alert(`¡Renovado con éxito! Se registró un pago de ${formatPEN(client.precio)} vía ${renewData.metodo}.`)
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active': return <span className="badge active">✓ Al Día</span>
      case 'warning': return <span className="badge warning">⏰ Por Vencer</span>
      case 'expired': return <span className="badge expired">✕ Vencido</span>
      default: return null
    }
  }

  const getTabTitle = () => {
    const titles = { dashboard: 'Panel de Control', clientes: 'Clientes', servicios: 'Catálogo de Servicios', cobros: 'Gestión de Cobros', configuracion: 'Configuración' }
    return titles[activeTab] || ''
  }

  if (loadingSession) return <div style={{display:'flex', height:'100vh', justifyContent:'center', alignItems:'center'}}>Cargando...</div>

  // PANTALLA DE LOGIN
  if (!session) {
    return (
      <div style={{display: 'flex', height: '100vh', background: 'var(--bg-dark)', alignItems: 'center', justifyContent: 'center'}}>
        <div className="card liquid-glass" style={{width: '100%', maxWidth: '400px', padding: '30px'}}>
          <div style={{textAlign:'center', marginBottom:'30px'}}>
            <div className="logo-icon">📡</div>
            <h2 style={{fontSize: '1.5rem'}}>SubManager <span className="highlight">Pro</span></h2>
            <p className="text-muted">Inicia sesión para gestionar tu negocio</p>
          </div>
          
          {authError && <div style={{background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '10px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem'}}>{authError}</div>}
          
          <form onSubmit={handleAuth}>
            <div className="form-group">
              <label>Correo Electrónico</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tucorreo@email.com" />
            </div>
            <div className="form-group">
              <label>Contraseña</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '10px', padding: '12px'}}>
              {isRegistering ? 'Crear Cuenta' : 'Ingresar'}
            </button>
          </form>
          
          <div style={{textAlign: 'center', marginTop: '20px'}}>
            <button onClick={() => setIsRegistering(!isRegistering)} style={{background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem'}}>
              {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate gratis'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            <section className="stats-grid">
              <div className="stat-card liquid-glass">
                <div className="stat-icon clients">👥</div>
                <div>
                  <h3>Total Clientes</h3>
                  <p>{clients.length}</p>
                  <span className="stat-sub">{alDiaCount} al día</span>
                </div>
              </div>
              <div className="stat-card liquid-glass">
                <div className="stat-icon revenue">💰</div>
                <div>
                  <h3>Ingresos Mensuales</h3>
                  <p>{formatPEN(ingresosTotal)}</p>
                  <span className="stat-sub">Soles peruanos</span>
                </div>
              </div>
              <div className="stat-card liquid-glass">
                <div className="stat-icon warning-stat">⏰</div>
                <div>
                  <h3>Por Vencer</h3>
                  <p className="text-warning">{porVencerCount}</p>
                  <span className="stat-sub">en los próximos 3 días</span>
                </div>
              </div>
              <div className="stat-card liquid-glass">
                <div className="stat-icon danger-stat">🚨</div>
                <div>
                  <h3>Vencidos</h3>
                  <p className="text-danger">{vencidosCount}</p>
                  <span className="stat-sub">requieren atención</span>
                </div>
              </div>
            </section>

            <div className="main-grid">
              <div className="card liquid-glass">
                <div className="card-header">
                  <h2>Clientes Recientes</h2>
                  <button className="btn-secondary" onClick={() => setActiveTab('clientes')}>Ver todos →</button>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Servicio</th>
                        <th>Vencimiento</th>
                        <th>Monto</th>
                        <th>Estado</th>
                        <th>Renovar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.slice(0, 5).map(client => (
                        <tr key={client.id}>
                          <td>
                            <div className="client-cell">
                              <div className="client-avatar-sm">{client.name.charAt(0)}</div>
                              <div>
                                <div className="fw-500">{client.name}</div>
                                <div className="text-muted tiny">{client.phone}</div>
                              </div>
                            </div>
                          </td>
                          <td>{client.service}</td>
                          <td>{formatFecha(client.dueDate)}</td>
                          <td className="fw-500">{formatPEN(client.precio)}</td>
                          <td>{getStatusBadge(client.status)}</td>
                          <td>
                            <button className="btn-wa" onClick={() => setShowRenewModal(client.id)}>💸 Renovar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card liquid-glass status-card">
                <h2>Estado de WhatsApp</h2>
                {status.ready ? (
                  <div className="status-connected">
                    <div className="pulse green"></div>
                    <div>
                      <h4>Conectado</h4>
                      <p>Listo para enviar notificaciones.</p>
                    </div>
                  </div>
                ) : (
                  <div className="status-disconnected">
                    <div className="pulse red"></div>
                    <div>
                      <h4>Desconectado</h4>
                      <p>Escanea el QR para vincular tu WhatsApp.</p>
                    </div>
                  </div>
                )}
                <button className="btn-primary wa-btn" onClick={() => setShowQRModal(true)}>
                  📱 Vincular WhatsApp
                </button>

                <div className="divider"></div>
                <h3 className="mini-title">Acciones Rápidas</h3>
                <div className="quick-actions">
                  <button className="quick-btn" onClick={() => setActiveTab('cobros')}>📋 Ver Cobros</button>
                  <button className="quick-btn" onClick={() => setShowAddModal(true)}>➕ Nuevo Cliente</button>
                </div>
              </div>
            </div>
          </>
        )

      case 'clientes':
        return (
          <div className="card liquid-glass full-card">
            <div className="card-header">
              <h2>Directorio de Clientes</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="search-box">
                  <span>🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar por nombre, teléfono o servicio..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Añadir Cliente</button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>DNI</th>
                    <th>WhatsApp</th>
                    <th>Servicio</th>
                    <th>Vencimiento</th>
                    <th>Monto (S/)</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No se encontraron clientes.</td></tr>
                  ) : clientesFiltrados.map(client => (
                    <tr key={client.id}>
                      <td>
                        <div className="client-cell">
                          <div className="client-avatar-sm">{client.name.charAt(0)}</div>
                          <span className="fw-500">{client.name}</span>
                        </div>
                      </td>
                      <td className="text-muted">{client.dni || '-'}</td>
                      <td className="text-muted">{client.phone}</td>
                      <td>{client.service}</td>
                      <td>{formatFecha(client.dueDate)}</td>
                      <td className="fw-500">{formatPEN(client.precio)}</td>
                      <td>{getStatusBadge(client.status)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn-wa" onClick={() => setShowRenewModal(client.id)} title="Renovar">💸</button>
                          <button className="btn-icon-wa" title="Enviar WhatsApp">💬</button>
                          <button className="btn-icon-edit" onClick={() => {setEditingClient(client); setShowEditModal(true)}} title="Editar">✏️</button>
                          <button className="btn-icon-del" title="Eliminar" onClick={() => setShowDeleteConfirm(client.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )

      case 'servicios':
        return (
          <div className="card liquid-glass full-card">
            <div className="card-header">
              <h2>Catálogo de Servicios</h2>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>Precios en Soles (S/) — Mercado Peruano 2026</span>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <div className="services-grid">
                {SERVICIOS_PERU.map((s, i) => {
                  const clientesConServicio = clients.filter(c => c.service === s.nombre).length
                  return (
                    <div key={i} className="service-card liquid-glass">
                      <div className="service-top">
                        <span className="service-emoji">{getServiceEmoji(s.nombre)}</span>
                        <span className={`service-badge ${clientesConServicio > 0 ? 'badge active' : 'badge'}`}>
                          {clientesConServicio} clientes
                        </span>
                      </div>
                      <h3>{s.nombre}</h3>
                      <p className="service-price">{formatPEN(s.precio)}<span>/mes</span></p>
                      <div className="service-actions">
                        <button className="btn-secondary small" onClick={() => { setNewClient(n => ({...n, service: s.nombre})); setShowAddModal(true) }}>+ Cliente</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )

      case 'cobros':
        return (
          <div className="card liquid-glass full-card">
            <div className="card-header">
              <h2>Gestión de Cobros</h2>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>Resumen de pagos — {new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}</span>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <div className="cobros-stats">
                <div className="cobro-stat-card">
                  <h4>Cobrado este mes</h4>
                  <p className="text-success">{formatPEN(clients.filter(c => c.status === 'active').reduce((a, c) => a + c.precio, 0))}</p>
                </div>
                <div className="cobro-stat-card">
                  <h4>Pendiente de cobro</h4>
                  <p className="text-warning">{formatPEN(clients.filter(c => c.status !== 'active').reduce((a, c) => a + c.precio, 0))}</p>
                </div>
                <div className="cobro-stat-card">
                  <h4>Total proyectado</h4>
                  <p>{formatPEN(ingresosTotal)}</p>
                </div>
              </div>
              <h3 style={{ margin: '20px 0 12px', fontSize: '0.95rem', color: 'var(--text-muted)' }}>CLIENTES CON PAGO PENDIENTE</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>WhatsApp</th>
                    <th>Servicio</th>
                    <th>Vencimiento</th>
                    <th>Monto</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.filter(c => c.status !== 'active').map(client => (
                    <tr key={client.id}>
                      <td className="fw-500">{client.name}</td>
                      <td className="text-muted">{client.phone}</td>
                      <td>{client.service}</td>
                      <td>{formatFecha(client.dueDate)}</td>
                      <td className="fw-500">{formatPEN(client.precio)}</td>
                      <td>{getStatusBadge(client.status)}</td>
                      <td>
                        <button className="btn-wa" onClick={() => setShowRenewModal(client.id)}>💸 Renovar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )

      case 'configuracion':
        return (
          <div className="card liquid-glass full-card">
            <div className="card-header">
              <h2>Configuración del Sistema</h2>
            </div>
            <div className="config-grid">
              <div className="config-section">
                <h3>📱 Negocio</h3>
                <div className="form-group">
                  <label>Nombre del Negocio</label>
                  <input type="text" defaultValue="Mi Streaming Store" />
                </div>
                <div className="form-group">
                  <label>Ciudad (Perú)</label>
                  <select defaultValue="Lima">
                    <option>Lima</option>
                    <option>Arequipa</option>
                    <option>Trujillo</option>
                  </select>
                </div>
              </div>
              <div className="config-section">
                <h3>💬 Mensajes de WhatsApp</h3>
                <div className="form-group">
                  <label>Mensaje de Recordatorio (días antes)</label>
                  <textarea rows="4" defaultValue={`¡Hola {{nombre}}! 👋\n\nTe recordamos que tu servicio de *{{servicio}}* vence el {{fecha}}.\n\nMonto a pagar: S/ {{monto}}\n\nPor favor realiza tu pago para no quedarte sin servicio. 🙏`}></textarea>
                </div>
              </div>
              <div className="config-section">
                <h3>⚙️ Automatización</h3>
                <div className="form-group">
                  <label>Días de anticipación para avisar</label>
                  <input type="number" defaultValue="3" style={{ width: '80px' }} />
                </div>
                <button className="btn-primary" style={{ marginTop: '8px' }}>💾 Guardar Configuración</button>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">📡</div>
          <h2>SubManager <span className="highlight">Pro</span></h2>
          <p className="logo-sub">Gestión de Cobros · Perú</p>
        </div>
        <nav className="nav-menu">
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
            <span className="icon">📊</span> Dashboard
          </button>
          <button className={activeTab === 'clientes' ? 'active' : ''} onClick={() => setActiveTab('clientes')}>
            <span className="icon">👥</span> Clientes
            {vencidosCount > 0 && <span className="nav-badge">{vencidosCount}</span>}
          </button>
          <button className={activeTab === 'cobros' ? 'active' : ''} onClick={() => setActiveTab('cobros')}>
            <span className="icon">💳</span> Cobros
            {(vencidosCount + porVencerCount) > 0 && <span className="nav-badge danger">{vencidosCount + porVencerCount}</span>}
          </button>
          <button className={activeTab === 'servicios' ? 'active' : ''} onClick={() => setActiveTab('servicios')}>
            <span className="icon">📺</span> Servicios
          </button>
          <button className={activeTab === 'configuracion' ? 'active' : ''} onClick={() => setActiveTab('configuracion')}>
            <span className="icon">⚙️</span> Configuración
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="footer-info">
            <span className="flag">🇵🇪</span>
            <span>SubManager v1.0 · Perú</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <div>
            <h1>{getTabTitle()}</h1>
            <p className="subtitle">
              {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="header-actions">
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Añadir Cliente</button>
            <div className="user-profile" onClick={handleLogout} title="Cerrar Sesión">
              <div className="avatar">{session?.user?.email?.charAt(0).toUpperCase()}</div>
              <div>
                <span className="user-name">{session?.user?.email?.split('@')[0]}</span>
                <span className="user-role">Cerrar Sesión</span>
              </div>
            </div>
          </div>
        </header>

        {renderContent()}

        {/* Modal: Añadir Cliente */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal glass" onClick={e => e.stopPropagation()}>
              <h2>➕ Añadir Nuevo Cliente</h2>
              <form onSubmit={handleAddClient}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nombre Completo *</label>
                    <input type="text" required placeholder="Ej. Carlos Quispe" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>DNI</label>
                    <input type="text" placeholder="12345678" maxLength={8} value={newClient.dni} onChange={e => setNewClient({ ...newClient, dni: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Teléfono WhatsApp *</label>
                  <input type="text" required placeholder="+51 987 654 321" value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Servicio Contratado *</label>
                    <select required value={newClient.service} onChange={e => {
                      const info = SERVICIOS_PERU.find(s => s.nombre === e.target.value)
                      setNewClient({ ...newClient, service: e.target.value, precio: info?.precio || '' })
                    }}>
                      <option value="">Selecciona...</option>
                      {SERVICIOS_PERU.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Precio (S/) *</label>
                    <input type="number" required placeholder="35" value={newClient.precio} onChange={e => setNewClient({ ...newClient, precio: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Fecha de Vencimiento *</label>
                  <input type="date" required value={newClient.dueDate} onChange={e => setNewClient({ ...newClient, dueDate: e.target.value })} />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary">💾 Guardar Cliente</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Editar Cliente */}
        {showEditModal && editingClient && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal glass" onClick={e => e.stopPropagation()}>
              <h2>✏️ Editar Cliente</h2>
              <form onSubmit={handleEditClient}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nombre Completo *</label>
                    <input type="text" required value={editingClient.name} onChange={e => setEditingClient({ ...editingClient, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>DNI</label>
                    <input type="text" maxLength={8} value={editingClient.dni || ''} onChange={e => setEditingClient({ ...editingClient, dni: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Teléfono WhatsApp *</label>
                  <input type="text" required value={editingClient.phone} onChange={e => setEditingClient({ ...editingClient, phone: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Servicio Contratado *</label>
                    <select required value={editingClient.service} onChange={e => {
                      const info = SERVICIOS_PERU.find(s => s.nombre === e.target.value)
                      setEditingClient({ ...editingClient, service: e.target.value, precio: info?.precio || editingClient.precio })
                    }}>
                      {SERVICIOS_PERU.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Precio (S/) *</label>
                    <input type="number" required value={editingClient.precio} onChange={e => setEditingClient({ ...editingClient, precio: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Fecha de Vencimiento *</label>
                  <input type="date" required value={editingClient.dueDate} onChange={e => setEditingClient({ ...editingClient, dueDate: e.target.value })} />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary">💾 Actualizar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Renovar (1 Clic) */}
        {showRenewModal && (
          <div className="modal-overlay" onClick={() => setShowRenewModal(null)}>
            <div className="modal glass text-center" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💸</div>
              <h2>Registrar Pago y Renovar</h2>
              <p className="text-muted" style={{ margin: '10px 0 20px' }}>
                Se sumará 1 mes a su fecha de vencimiento y se guardará en el historial de pagos.
              </p>
              <form onSubmit={handleRenew}>
                <div className="form-group" style={{textAlign:'left'}}>
                  <label>¿Cómo pagó el cliente?</label>
                  <select value={renewData.metodo} onChange={e => setRenewData({...renewData, metodo: e.target.value})}>
                    <option value="Yape">📱 Yape</option>
                    <option value="Plin">📱 Plin</option>
                    <option value="BCP">🏦 Transferencia BCP</option>
                    <option value="Interbank">🏦 Transferencia Interbank</option>
                    <option value="Efectivo">💵 Efectivo</option>
                  </select>
                </div>
                <div className="modal-actions" style={{ justifyContent: 'center' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowRenewModal(null)}>Cancelar</button>
                  <button type="submit" className="btn-wa">Renovar Cliente (+1 Mes)</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Confirmar Eliminación */}
        {showDeleteConfirm && (
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
            <div className="modal glass text-center" style={{ maxWidth: '360px' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
              <h2>¿Eliminar cliente?</h2>
              <p className="text-muted" style={{ margin: '10px 0 20px' }}>
                Esta acción no se puede deshacer.
              </p>
              <div className="modal-actions" style={{ justifyContent: 'center' }}>
                <button className="btn-secondary" onClick={() => setShowDeleteConfirm(null)}>Cancelar</button>
                <button className="btn-danger" onClick={() => handleDelete(showDeleteConfirm)}>🗑️ Sí, Eliminar</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function getServiceEmoji(nombre) {
  if (nombre.includes('Netflix')) return '🎬'
  if (nombre.includes('Spotify')) return '🎵'
  if (nombre.includes('Disney')) return '🏰'
  if (nombre.includes('HBO')) return '📺'
  if (nombre.includes('Amazon')) return '📦'
  if (nombre.includes('YouTube')) return '▶️'
  if (nombre.includes('Crunchyroll')) return '⛩️'
  return '📡'
}

export default App
