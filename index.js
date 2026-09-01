const express = require('express');
const app = express();

app.use(express.json());

// Base de datos persistente (Podés usar MongoDB o un archivo base.json)
// Ejemplo de estructura en memoria / JSON:
let clientesDB = {
  "LIC-ALMACEN-JOSE-88": {
    cliente: "Almacén de José",
    estado: "ACTIVA",
    tipo: "SUSCRIPCION",
    fechaVencimiento: "2026-10-01",
    preapprovalId: null
  }
};

// ==========================================
// 1. ENDPOINT DE VALIDACIÓN (OmniPOS lo consulta al iniciar)
// ==========================================
app.get('/api/validar-licencia/:clave', (req, res) => {
  const clave = req.params.clave.toUpperCase();
  const licencia = clientesDB[clave];

  if (!licencia) {
    return res.json({ ok: false, activa: false, motivo: "LICENCIA_NO_EXISTE" });
  }

  const hoy = new Date().toISOString().split('T')[0];
  const estaAlDia = licencia.estado === 'ACTIVA' && licencia.fechaVencimiento >= hoy;

  return res.json({
    ok: true,
    activa: estaAlDia,
    estado: licencia.estado,
    fechaVencimiento: licencia.fechaVencimiento,
    cliente: licencia.cliente,
    tipo: licencia.tipo
  });
});

// ==========================================
// 2. WEBHOOK AUTOMÁTICO DE MERCADO PAGO
// ==========================================
app.post('/api/webhook-mercadopago', (req, res) => {
  const body = req.body;

  // Imprimimos en consola la notificación entrante de Mercado Pago
  console.log("Notificación MP recibida:", JSON.stringify(body, null, 2));

  // A. Si se creó o cobró una suscripción
  if (body.type === 'payment' || body.action === 'payment.created') {
    const externalReference = body.data?.external_reference || body.external_reference;
    const status = body.data?.status || body.status;

    if (externalReference && status === 'approved') {
      const clave = externalReference.toUpperCase();

      if (clientesDB[clave]) {
        // Extendemos 30 días más la vigencia de la licencia
        const fechaActual = new Date();
        fechaActual.setDate(fechaActual.getDate() + 30);

        clientesDB[clave].fechaVencimiento = fechaActual.toISOString().split('T')[0];
        clientesDB[clave].estado = 'ACTIVA';

        console.log(`✅ ¡Pago Aprobado! Licencia ${clave} extendida hasta ${clientesDB[clave].fechaVencimiento}`);
      }
    }
  }

  // Mercado Pago exige responder con un status HTTP 200 OK
  res.sendStatus(200);
});

// ==========================================
// 3. REGISTRO MANUAL DE CLIENTE NUEVO (ADMIN)
// ==========================================
app.post('/api/alta-cliente', (req, res) => {
  const { clave, cliente, tipo } = req.body;

  if (!clave || !cliente) {
    return res.status(400).json({ ok: false, error: "Faltan datos obligatorios." });
  }

  const claveUpper = clave.toUpperCase();
  
  // Asignamos 14 días iniciales de prueba por defecto
  const fechaVto = new Date();
  fechaVto.setDate(fechaVto.getDate() + 14);

  clientesDB[claveUpper] = {
    cliente,
    estado: 'ACTIVA',
    tipo: tipo || 'SUSCRIPCION',
    fechaVencimiento: fechaVto.toISOString().split('T')[0]
  };

  res.json({ ok: true, mensaje: "Cliente registrado con exito", data: clientesDB[claveUpper] });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor de Licencias OmniPOS corriendo en el puerto ${PORT}`));