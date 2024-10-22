const express = require('express');
const router = express.Router();
const pool = require('./database'); // Importar el pool de conexiones

// Definir rutas
router.get('/', (req, res) => {
    res.send('Bienvenido a la API');
});

// Ruta para recibir la imagen en formato base64, la MAC address y el ID del dispositivo
router.post('/video', async (req, res) => {
    console.log('Solicitud POST a /camara recibida');

    const { mac: mac_address, image: guardar_fotografia, id: ID_Dispositivo } = req.body;

    if (!mac_address || !guardar_fotografia || !ID_Dispositivo) {
        console.error('Faltan datos requeridos');
        return res.status(400).send('Faltan datos requeridos');
    }

    const fecha = new Date().toISOString().split('T')[0];
    const hora = new Date().toISOString().split('T')[1].split('.')[0];

    try {
        // Insertar la nueva imagen
        const insertQuery = 'INSERT INTO Camara (mac_address, guardar_fotografia, fecha, hora, ID_Dispositivo) VALUES (?, ?, ?, ?, ?)';
        await pool.query(insertQuery, [mac_address, guardar_fotografia, fecha, hora, ID_Dispositivo]);
        console.log('Datos insertados correctamente:', { mac_address, guardar_fotografia, fecha, hora, ID_Dispositivo });
        res.status(200).send('Datos insertados correctamente');

        // Esperar 5 segundos antes de eliminar las imágenes antiguas
        setTimeout(async () => {
            // Eliminar imágenes que tienen más de 5 segundos de antigüedad para el mismo dispositivo
            const deleteQuery = `
                DELETE FROM Camara 
                WHERE ID_Dispositivo = ? 
                AND TIMESTAMPDIFF(SECOND, CONCAT(fecha, ' ', hora), NOW()) > 5
            `;
            const [result] = await pool.query(deleteQuery, [ID_Dispositivo]);
            console.log('Imágenes antiguas eliminadas:', result.affectedRows);
        }, 5000); // Esperar 5 segundos
    } catch (err) {
        console.error('Error al insertar los datos en la base de datos:', err);
        res.status(500).send('Error al insertar los datos en la base de datos');
    }
});

// Ruta para el inicio de sesión
router.post('/login', async (req, res) => {
    console.log('Datos recibidos en la solicitud:', req.body); // Mostrar en consola lo que se envía

    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        return res.status(400).send('Faltan datos requeridos');
    }

    try {
        const query = 'SELECT * FROM Usuario WHERE correo = ?';
        const [results] = await pool.query(query, [correo]);

        if (results.length === 0) {
            return res.status(400).send('Usuario incorrecto');
        }

        const user = results[0];
        if (user.contrasena !== contrasena) {
            return res.status(400).send('Contraseña incorrecta');
        }

        res.status(200).send({ message: 'Usuario correcto', id: user.id });
    } catch (err) {
        console.error('Error al consultar la base de datos:', err);
        res.status(500).send('Error al consultar la base de datos');
    }
});

// Ruta para registrar un nuevo usuario
router.post('/register', async (req, res) => {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        return res.status(400).send('Faltan datos requeridos');
    }

    const query = 'INSERT INTO Usuario (correo, contrasena) VALUES (?, ?)';
    db.query(query, [correo, contrasena], (err, result) => {
        if (err) {
            console.error('Error al registrar el usuario:', err);
            return res.status(500).send('Error al registrar el usuario');
        }

        const userId = result.insertId;
        res.status(200).send({ message: 'Usuario creado correctamente', id: userId });
    });
});

// Ruta para obtener los dispositivos de un usuario
router.get('/dispositivos/:id', async (req, res) => {
    const userId = req.params.id;

    const query = `
        SELECT d.ID_Dispositivo, d.Nombre AS NombreDispositivo, td.NombreTipo 
        FROM Dispositivo d
        JOIN recursos r ON d.ID_Dispositivo = r.ID_Dispositivo
        JOIN TipoDispositivo td ON d.ID_Tipo = td.ID_Tipo
        WHERE r.ID_USER = ?
    `;
    try {
        const [results] = await pool.query(query, [userId]);

        if (results.length === 0) {
            return res.status(200).send('No tiene dispositivo');
        }

        res.status(200).send(results);
    } catch (err) {
        console.error('Error al consultar la base de datos:', err);
        res.status(500).send('Error al consultar la base de datos');
    }
});






// Ruta para obtener la información de un dispositivo por ID
router.get('/recursocamara/:id', async (req, res) => {
    const dispositivoId = req.params.id;

    const query = `
        SELECT c.guardar_fotografia, c.fecha, c.hora, d.Nombre AS NombreDispositivo
        FROM Camara c
        JOIN Dispositivo d ON c.ID_Dispositivo = d.ID_Dispositivo
        WHERE c.ID_Dispositivo = ?
        ORDER BY c.fecha DESC, c.hora DESC
        LIMIT 1
    `;
    try {
        const [results] = await pool.query(query, [dispositivoId]);
        if (results.length === 0) {
            return res.status(200).send('No hay imagen');
        }
        console.log('Respuesta enviada:', results[0]);
        res.status(200).send(results[0]);
    } catch (err) {
        console.error('Error al consultar la base de datos:', err);
        res.status(500).send('Error al consultar la base de datos');
    }
});

// Ruta para obtener la información del usuario y la cantidad de dispositivos que tiene
router.get('/usuario/:id', async (req, res) => {
    const userId = req.params.id;

    const query = `
        SELECT u.correo, u.contrasena, COUNT(d.ID_Dispositivo) AS cantidad_dispositivos
        FROM Usuario u
        LEFT JOIN recursos r ON u.id = r.ID_USER
        LEFT JOIN Dispositivo d ON r.ID_Dispositivo = d.ID_Dispositivo
        WHERE u.id = ?
        GROUP BY u.id
    `;
    try {
        const [results] = await pool.query(query, [userId]);
        if (results.length === 0) {
            return res.status(200).send('No se encontraron dispositivos para este usuario');
        }
        res.status(200).send(results[0]);
    } catch (err) {
        console.error('Error al consultar la base de datos:', err);
        res.status(500).send('Error al consultar la base de datos');
    }
});

// Ruta para agregar un dispositivo a un usuario
router.post('/agregar-dispositivo', async (req, res) => {
    const { userId, nombreDispositivo, contrasenaDispositivo } = req.body;

    if (!userId || !nombreDispositivo || !contrasenaDispositivo) {
        const response = { message: 'Faltan datos requeridos' };
        console.log('Respuesta enviada:', response);
        return res.status(400).json(response);
    }

    try {
        // Verificar si el dispositivo ya está registrado en recursos para el usuario
        const checkQuery = `
            SELECT * FROM recursos r
            JOIN Dispositivo d ON r.ID_Dispositivo = d.ID_Dispositivo
            WHERE r.ID_USER = ? AND d.Nombre = ?
        `;
        const [results] = await pool.query(checkQuery, [userId, nombreDispositivo]);
        if (results.length > 0) {
            const response = { message: 'El dispositivo ya está registrado para este usuario' };
            console.log('Respuesta enviada:', response);
            return res.status(400).json(response);
        }

        // Verificar si el nombre y la contraseña del dispositivo coinciden
        const verifyQuery = 'SELECT * FROM Dispositivo WHERE Nombre = ? AND Contrasena = ?';
        const [verifyResults] = await pool.query(verifyQuery, [nombreDispositivo, contrasenaDispositivo]);
        if (verifyResults.length === 0) {
            const response = { message: 'Nombre o contraseña del dispositivo incorrectos' };
            console.log('Respuesta enviada:', response);
            return res.status(400).json(response);
        }

        const dispositivoId = verifyResults[0].ID_Dispositivo;

        // Agregar el dispositivo a la tabla recursos
        const insertQuery = 'INSERT INTO recursos (ID_Dispositivo, ID_USER) VALUES (?, ?)';
        await pool.query(insertQuery, [dispositivoId, userId]);
        const response = { message: 'Dispositivo agregado correctamente' };
        console.log('Respuesta enviada:', response);
        res.status(200).json(response);
    } catch (err) {
        const response = { message: 'Error al insertar los datos en la base de datos' };
        console.error('Error al insertar los datos en la base de datos:', err);
        console.log('Respuesta enviada:', response);
        res.status(500).json(response);
    }
});








// Ruta para recibir el mac address, el índice de calidad de aire y el ID del dispositivo
router.post('/monitoreo-aire', async (req, res) => {
    const { mac_address, indice_calidad_aire, ID_Dispositivo } = req.body;

    console.log('Datos recibidos:', { mac_address, indice_calidad_aire, ID_Dispositivo });

    if (!mac_address || !indice_calidad_aire || !ID_Dispositivo) {
        const response = { message: 'Faltan datos requeridos' };
        console.log('Respuesta enviada:', response);
        return res.status(400).json(response);
    }

    const fecha = new Date().toISOString().split('T')[0];
    const hora = new Date().toISOString().split('T')[1].split('.')[0];

    try {
        // Insertar los datos en la tabla MonitoreoDeAire
        const insertQuery = 'INSERT INTO MonitoreoDeAire (mac_address, indice_calidad_aire, fecha, hora, ID_Dispositivo) VALUES (?, ?, ?, ?, ?)';
        await pool.query(insertQuery, [mac_address, indice_calidad_aire, fecha, hora, ID_Dispositivo]);
        const response = { message: 'Datos insertados correctamente' };
        console.log('Respuesta enviada:', response);
        res.status(200).json(response);
    } catch (err) {
        const response = { message: 'Error al insertar los datos en la base de datos' };
        console.error('Error al insertar los datos en la base de datos:', err);
        console.log('Respuesta enviada:', response);
        res.status(500).json(response);
    }
});

// Ruta para obtener el índice de calidad de aire, fecha, hora y nombre del dispositivo en base al ID del usuario
router.get('/calidad-aire/:userId', async (req, res) => {
    const userId = req.params.userId;

    const query = `
        SELECT m.indice_calidad_aire, m.fecha, m.hora, d.Nombre AS NombreDispositivo
        FROM MonitoreoDeAire m
        JOIN Dispositivo d ON m.ID_Dispositivo = d.ID_Dispositivo
        JOIN recursos r ON d.ID_Dispositivo = r.ID_Dispositivo
        WHERE r.ID_USER = ?
        ORDER BY m.fecha DESC, m.hora DESC
        LIMIT 1
    `;
    try {
        const [results] = await pool.query(query, [userId]);
        if (results.length === 0) {
            const response = { message: 'No se encontraron datos de calidad de aire para este usuario' };
            console.log('Respuesta enviada:', response);
            return res.status(200).json(response);
        }
        const response = results[0];
        console.log('Respuesta enviada:', response);
        res.status(200).json(response);
    } catch (err) {
        const response = { message: 'Error al consultar la base de datos' };
        console.error('Error al consultar la base de datos:', err);
        console.log('Respuesta enviada:', response);
        res.status(500).json(response);
    }
});

module.exports = router;