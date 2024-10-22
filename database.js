const mysql = require('mysql2');
const dotenv = require('dotenv');

// Configurar variables de entorno
dotenv.config();

// Crear la conexión a la base de datos
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

// Conectar a la base de datos
connection.connect(err => {
    if (err) {
        console.error('No se pudo conectar a la base de datos:', err);
        return;
    }
    console.log('Conectado a la base de datos');
});

module.exports = connection;