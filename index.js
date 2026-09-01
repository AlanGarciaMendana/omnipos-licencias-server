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
  }
};

// Ruta principal para verificar que el servidor está online
app.get('/', (req, res) => {
  res.send('<h1>Servidor de Licencias OmniPOS Activo 🚀</h1>');
});

// 1. Endpoint para validar licencias desde OmniPOS
app.get('/api/validar-licencia/:clave', (req, res) => {
  const clave = req.params.clave ? req.params.clave.toUpperCase() : '';
  const cliente = clientesDB[clave];

  if (!cliente) {
    return res.status(404).json({
      valida: false,
      estado: 'INEXISTENTE',
      mensaje: 'La clave ingresada no existe.'
    });
  }

  // Verificación de expiración si está dada de alta
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

// 2. Endpoint Admin para dar de alta licencias (Estado inicial: PENDIENTE_PAGO)
app.post('/api/alta-cliente', (req, res) => {
  const { clave, cliente } = req.body;

  if (!clave) {
    return res.status(400).json({ ok: false, error: "El campo 'clave' es obligatorio." });
  }

  const claveUpper = clave.toUpperCase();

  clientesDB[claveUpper] = {
    cliente: cliente || "Nuevo Cliente",
    estado: 'PENDIENTE_PAGO',
    valida: false,
    tipo: 'SUSCRIPCION',
    fechaVencimiento: null
  };

  console.log(`[ADMIN] Licencia creada: ${claveUpper} (${clientesDB[claveUpper].cliente}) - Estado: PENDIENTE_PAGO`);

  res.json({
    ok: true,
    mensaje: `Licencia ${claveUpper} creada con éxito en estado PENDIENTE_PAGO.`,
    licencia: clientesDB[claveUpper]
  });
});

// 3. Webhook de Mercado Pago (Recibe avisos de suscripción/pago y activa la licencia)
app.post('/api/webhook-mercadopago', (req, res) => {
  // Responder 200 OK inmediatamente a Mercado Pago
  res.status(200).send('OK');

  const body = req.body || {};
  console.log('Notificación Webhook MP recibida:', JSON.stringify(body));

  try {
    // Intentar obtener la clave (external_reference) desde distintas ubicaciones del evento
    let clave = body.data?.external_reference || body.external_reference;

    if (clave && clientesDB[clave]) {
      activarLicencia(clave);
    } else {
      // Fallback: Si es un evento de suscripción (preapproval) y MP no mandó external_reference explícito,
      // activamos la última licencia registrada que esté en estado PENDIENTE_PAGO
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
  console.log(`Servidor de Licencias OmniPOS corriendo en el puerto ${PORT}`);
});
