const express = require('express');
const app = express();
const routes = require('./routes');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Configurar variables de entorno
dotenv.config();

// Conectar a la base de datos
mongoose.connect(process.env.DB_CONNECTION, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Conectado a la base de datos'))
    .catch(err => console.error('No se pudo conectar a la base de datos', err));

// Middleware para parsear JSON
app.use(express.json());

// Usar las rutas
app.use('/api', routes);

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});