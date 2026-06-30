require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Supabase Admin Client
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log("Supabase conectado en el backend para tareas automáticas.");
} else {
    console.warn("⚠️ ADVERTENCIA: Falta SUPABASE_SERVICE_ROLE_KEY en el backend. Los mensajes automáticos no funcionarán.");
}

// Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth()
});

let qrCodeData = null;
let clientReady = false;

client.on('qr', (qr) => {
    qrcode.generate(qr, {small: true});
    qrCodeData = qr;
    clientReady = false;
    console.log('QR Code received, please scan it with your phone.');
});

client.on('ready', () => {
    console.log('¡WhatsApp conectado correctamente!');
    clientReady = true;
    qrCodeData = null;
});

client.initialize();

app.get('/api/status', (req, res) => {
    res.json({
        ready: clientReady,
        qr: qrCodeData
    });
});

app.post('/api/send-message', async (req, res) => {
    if (!clientReady) return res.status(400).json({ error: 'WhatsApp no está listo' });
    
    const { phone, message } = req.body;
    try {
        const formattedPhone = phone.replace('+', '') + '@c.us';
        await client.sendMessage(formattedPhone, message);
        res.json({ success: true });
    } catch (error) {
        console.error('Error enviando mensaje:', error);
        res.status(500).json({ error: 'Error al enviar el mensaje' });
    }
});

// TAREAS AUTOMÁTICAS (CRON JOBS)
cron.schedule('0 8 * * *', async () => {
    console.log('Ejecutando revisión diaria de clientes por vencer (8:00 AM)...');
    
    if (!clientReady || !supabase) {
        console.log('WhatsApp o Supabase no están listos. Abortando notificaciones.');
        return;
    }

    try {
        const hoy = new Date();
        const enTresDias = new Date();
        enTresDias.setDate(hoy.getDate() + 3);
        const fechaTresDiasStr = enTresDias.toISOString().split('T')[0];

        const { data: clientes, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('vencimiento', fechaTresDiasStr)
            .eq('estado', 'active');

        if (error) throw error;

        console.log(`Se encontraron ${clientes.length} clientes que vencen en 3 días.`);

        for (const cliente of clientes) {
            const mensaje = `¡Hola ${cliente.nombre}! 👋\n\nTe recordamos que tu servicio de *${cliente.servicio}* vence el ${cliente.vencimiento}.\n\nMonto a pagar: S/ ${cliente.precio}\n\nPor favor realiza tu pago para no quedarte sin servicio. 🙏`;
            
            const formattedPhone = cliente.telefono.replace('+', '') + '@c.us';
            await client.sendMessage(formattedPhone, mensaje);
            
            await supabase.from('clientes').update({ estado: 'warning' }).eq('id', cliente.id);
            console.log(`✅ Aviso enviado a ${cliente.nombre} (${cliente.telefono})`);
            
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    } catch (error) {
        console.error('Error en la tarea automática:', error);
    }
});

app.listen(port, () => {
    console.log(`Backend server is running on port ${port}`);
});
