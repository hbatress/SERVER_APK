const express = require('express');
const cors = require('cors');
const app = express();
const dotenv = require('dotenv');
const routes = require('./routes');
const bodyParser = require('body-parser');

// Configurar variables de entorno
dotenv.config();

// Habilitar CORS para todas las solicitudes
app.use(cors());

// Middleware para parsear JSON con un límite de tamaño aumentado
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Usar las rutas
app.use('/', routes);

// Middleware de manejo de errores
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('Bad JSON');
        return res.status(400).send({ message: 'Bad JSON' });
    }
    next();
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});