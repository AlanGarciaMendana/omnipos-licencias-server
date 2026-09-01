const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Habilitar CORS para permitir peticiones desde OmniPOS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

// Ruta principal de bienvenida
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

  // Verificamos si la fecha de vencimiento expiró
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

// 3. Webhook de Mercado Pago (Recibe avisos de cobro y activa/extiende licencias)
app.post('/api/webhook-mercadopago', (req, res) => {
  const body = req.body;
  console.log('Notificación Webhook MP recibida:', JSON.stringify(body));

  // Responder 200 OK inmediatamente a Mercado Pago para confirmar recepción
  res.status(200).send('OK');

  // Procesar evento de pago / suscripción
  try {
    const clave = body.data?.external_reference || body.external_reference;

    if (clave && clientesDB[clave]) {
      // Calcular 30 días a partir de hoy
      const nuevaFecha = new Date();
      nuevaFecha.setDate(nuevaFecha.getDate() + 30);
      const fechaIso = nuevaFecha.toISOString().split('T')[0];

      // Activar la licencia
      clientesDB[clave].estado = 'ACTIVA';
      clientesDB[clave].valida = true;
      clientesDB[clave].fechaVencimiento = fechaIso;

      console.log(`✅ [WEBHOOK] Licencia ${clave} activada/renovada exitosamente hasta ${fechaIso}`);
    } else if (clave) {
      console.log(`⚠️ [WEBHOOK] Se recibió un pago para la clave ${clave}, pero no existe en clientesDB.`);
    }
  } catch (error) {
    console.error('❌ Error procesando datos del Webhook:', error);
  }
});

// Puerto dinámico asignado por Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor de Licencias OmniPOS corriendo en el puerto ${PORT}`);
});
