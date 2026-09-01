const express = require('express');
const app = express();

// Parsing de JSON y datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Permisos CORS globales (evita bloqueos 403 / preflight en Render)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Base de datos temporal en memoria (clientesDB)
const clientesDB = {
  "LIC-DEMO-01": {
    cliente: "Comercio Demo",
    estado: "ACTIVA",
    valida: true,
    tipo: "SUSCRIPCION",
    fechaVencimiento: "2026-12-31"
  },
  "DANTE": {
    cliente: "Dante Pruebas",
    estado: "ACTIVA",
    valida: true,
    tipo: "SUSCRIPCION",
    fechaVencimiento: "2027-12-31"
  }
};

// Ruta principal que redirige al panel administrativo
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// 1. Panel de Administración Web (/admin)
app.get('/admin', (req, res) => {
  let html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ZenixPOS - Panel de Licencias</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 30px; margin: 0; }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { color: #38bdf8; margin-bottom: 5px; }
        .card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 25px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr 120px auto; gap: 12px; align-items: end; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        label { font-size: 0.75rem; font-weight: bold; color: #94a3b8; text-transform: uppercase; }
        input, select { padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 0.9rem; }
        button { background: #0284c7; color: white; border: none; padding: 10px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; height: 40px; }
        button:hover { background: #0369a1; }
        table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #334155; font-size: 0.9rem; }
        th { background: #0284c7; font-size: 0.75rem; text-transform: uppercase; }
        .badge { padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 0.75rem; }
        .badge-activa { background: #dcfce7; color: #166534; }
        .badge-pendiente { background: #fef08a; color: #854d0e; }
        .badge-vencida { background: #fee2e2; color: #991b1b; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>ZenixPOS - Panel de Licencias</h1>
        <p style="color: #94a3b8; margin-top: 0;">Servidor de suscripciones e integración con MercadoPago.</p>

        <!-- FORMULARIO CREAR LICENCIA -->
        <div class="card">
          <h3 style="margin-top:0; color: #38bdf8;">➕ Generar Nueva Licencia</h3>
          <form action="/api/alta-cliente" method="POST" class="form-grid">
            <div class="form-group">
              <label>Clave / Código *</label>
              <input type="text" name="clave" placeholder="Ej: DANTE, CLIENTE-01" required style="text-transform: uppercase;">
            </div>
            <div class="form-group">
              <label>Nombre del Cliente / Local *</label>
              <input type="text" name="cliente" placeholder="Ej: Carnicería Don Juan" required>
            </div>
            <div class="form-group">
              <label>Estado Inicial</label>
              <select name="estadoInicial">
                <option value="ACTIVA">ACTIVA</option>
                <option value="PENDIENTE_PAGO" selected>PENDIENTE_PAGO</option>
              </select>
            </div>
            <button type="submit">✓ Crear</button>
          </form>
        </div>

        <!-- TABLA DE LICENCIAS -->
        <div class="card" style="padding: 0;">
          <table>
            <thead>
              <tr>
                <th>Clave</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Vencimiento</th>
              </tr>
            </thead>
            <tbody>
  `;

  const hoyStr = new Date().toISOString().split('T')[0];

  for (const [clave, data] of Object.entries(clientesDB)) {
    let estaActiva = data.estado === 'ACTIVA';
    if (data.fechaVencimiento && hoyStr > data.fechaVencimiento) {
      estaActiva = false;
    }

    let claseBadge = 'badge-pendiente';
    if (estaActiva) claseBadge = 'badge-activa';
    else if (data.estado === 'VENCIDA' || (data.fechaVencimiento && hoyStr > data.fechaVencimiento)) claseBadge = 'badge-vencida';

    html += `
      <tr>
        <td><strong style="color: #38bdf8;">${clave}</strong></td>
        <td>${data.cliente}</td>
        <td><span class="badge ${claseBadge}">${estaActiva ? 'ACTIVA' : data.estado}</span></td>
        <td>${data.fechaVencimiento || 'Sin activar'}</td>
      </tr>
    `;
  }

  html += `
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// 2. Endpoint para validar licencias desde ZenixPOS
app.get('/api/validar-licencia/:clave', (req, res) => {
  const clave = req.params.clave ? req.params.clave.toUpperCase().trim() : '';
  const cliente = clientesDB[clave];

  if (!cliente) {
    return res.status(404).json({
      valida: false,
      estado: 'INEXISTENTE',
      mensaje: 'La clave ingresada no existe.'
    });
  }

  // Verificación de expiración
  if (cliente.fechaVencimiento) {
    const hoy = new Date();
    const vto = new Date(cliente.fechaVencimiento);
    
    if (hoy > vto && cliente.estado === 'ACTIVA') {
      cliente.estado = 'VENCIDA';
      cliente.valida = false;
    }
  }

  res.json({
    clave: clave,
    valida: cliente.estado === 'ACTIVA',
    estado: cliente.estado,
    cliente: cliente.cliente,
    vencimiento: cliente.fechaVencimiento
  });
});

// 3. Endpoint Admin para dar de alta licencias (Soporta JSON y formularios de la web)
app.post('/api/alta-cliente', (req, res) => {
  const { clave, cliente, estadoInicial } = req.body;

  if (!clave) {
    return res.status(400).json({ ok: false, error: "El campo 'clave' es obligatorio." });
  }

  const claveUpper = clave.trim().toUpperCase();
  const estado = estadoInicial || 'PENDIENTE_PAGO';
  const esActiva = estado === 'ACTIVA';

  let fechaIso = null;
  if (esActiva) {
    const nuevaFecha = new Date();
    nuevaFecha.setDate(nuevaFecha.getDate() + 365);
    fechaIso = nuevaFecha.toISOString().split('T')[0];
  }

  clientesDB[claveUpper] = {
    cliente: cliente ? cliente.trim() : "Nuevo Cliente",
    estado: estado,
    valida: esActiva,
    tipo: 'SUSCRIPCION',
    fechaVencimiento: fechaIso
  };

  console.log(`[ADMIN] Licencia creada: ${claveUpper} (${clientesDB[claveUpper].cliente}) - Estado: ${estado}`);

  // Redirigir al panel si la solicitud viene del formulario HTML
  if (req.headers['content-type'] && req.headers['content-type'].includes('application/x-www-form-urlencoded')) {
    return res.redirect('/admin');
  }

  res.json({
    ok: true,
    mensaje: `Licencia ${claveUpper} creada con éxito.`,
    licencia: clientesDB[claveUpper]
  });
});

// 4. Webhook de Mercado Pago
app.post('/api/webhook-mercadopago', (req, res) => {
  res.status(200).send('OK');

  const body = req.body || {};
  console.log('Notificación Webhook MP recibida:', JSON.stringify(body));

  try {
    let clave = body.data?.external_reference || body.external_reference;

    if (clave && clientesDB[clave]) {
      activarLicencia(clave);
    } else {
      const pendientes = Object.keys(clientesDB).filter(k => clientesDB[k].estado === 'PENDIENTE_PAGO');
      if (pendientes.length > 0) {
        const claveAActivar = pendientes[pendientes.length - 1];
        console.log(`[WEBHOOK] Notificación detectada. Activando clave pendiente: ${claveAActivar}`);
        activarLicencia(claveAActivar);
      } else {
        console.log(`⚠️ [WEBHOOK] Notificación recibida sin external_reference directo ni licencias pendientes.`);
      }
    }
  } catch (error) {
    console.error('❌ Error procesando Webhook:', error);
  }
});

// Función auxiliar para extender la licencia 30 días
function activarLicencia(clave) {
  if (!clientesDB[clave]) return;

  const nuevaFecha = new Date();
  nuevaFecha.setDate(nuevaFecha.getDate() + 30);
  const fechaIso = nuevaFecha.toISOString().split('T')[0];

  clientesDB[clave].estado = 'ACTIVA';
  clientesDB[clave].valida = true;
  clientesDB[clave].fechaVencimiento = fechaIso;

  console.log(`✅ [WEBHOOK] Licencia ${clave} activada exitosamente hasta ${fechaIso}`);
}

// Puerto dinámico asignado por Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor de Licencias ZenixPOS corriendo en el puerto ${PORT}`);
});
