const express = require('express');
const router = express.Router();

// Definir rutas
router.get('/', (req, res) => {
    res.send('Bienvenido a la API');
});

module.exports = router;