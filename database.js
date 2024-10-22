const mysql = require('mysql2');
const dotenv = require('dotenv');

// Configurar variables de entorno
dotenv.config();

// Crear el pool de conexiones a la base de datos
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Exportar el pool de conexiones
module.exports = pool.promise();