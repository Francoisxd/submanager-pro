const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

// GET all clients
router.get('/', async (req, res) => {
    try {
        const snapshot = await db.collection('clients').get();
        const clients = [];
        snapshot.docs.forEach(doc => {
            clients.push({ id: doc.id, ...doc.data() });
        });
        res.json(clients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST new client
router.post('/', async (req, res) => {
    try {
        const { name, phone, service, dueDate, amount } = req.body;
        const newClient = {
            name,
            phone,
            service,
            dueDate,
            amount,
            createdAt: new Date().toISOString()
        };
        const docRef = await db.collection('clients').add(newClient);
        res.status(201).json({ id: docRef.id, ...newClient });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET specific client
router.get('/:id', async (req, res) => {
    try {
        const doc = await db.collection('clients').doc(req.params.id).get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Client not found' });
        }
        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE client
router.delete('/:id', async (req, res) => {
    try {
        await db.collection('clients').doc(req.params.id).delete();
        res.json({ message: 'Client deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
