const express = require('express');
const router = express.Router();
const db = require('./database'); // Importar la lógica de la base de datos
const moment = require('moment-timezone'); // Importar moment-timezone para manejar zonas horarias
// Definir rutas
router.get('/', (req, res) => {
    res.send('Bienvenido a la API');
});


// Estructura en memoria para almacenar las imágenes temporalmente
const imageStore = {};
const MAX_IMAGES = 20; // Limitar el número de imágenes almacenadas en memoria
const IMAGE_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutos en milisegundos

// Ruta para recibir la imagen en formato base64, la MAC address y el ID del dispositivo
router.post('/video', (req, res) => {
    console.log('Solicitud POST a /camara recibida');

    const { mac: mac_address, image: guardar_fotografia, id: ID_Dispositivo } = req.body;

    if (!mac_address || !guardar_fotografia || !ID_Dispositivo) {
        console.error('Faltan datos requeridos');
        return res.status(400).send('Faltan datos requeridos');
    }

    const fecha = moment().tz('America/Guatemala').format('YYYY-MM-DD');
    const hora = moment().tz('America/Guatemala').format('HH:mm:ss');

    // Almacenar la imagen en memoria
    if (!imageStore[ID_Dispositivo]) {
        imageStore[ID_Dispositivo] = { images: [], lastReceived: Date.now() };
    }
    imageStore[ID_Dispositivo].images.push({ guardar_fotografia, fecha, hora });
    imageStore[ID_Dispositivo].lastReceived = Date.now();

    // Limitar el número de imágenes almacenadas en memoria
    if (imageStore[ID_Dispositivo].images.length > MAX_IMAGES) {
        imageStore[ID_Dispositivo].images.shift(); // Eliminar la imagen más antigua
    }

    // Insertar los datos sin la imagen en la base de datos
    const insertQuery = 'INSERT INTO Camara (mac_address, fecha, hora, ID_Dispositivo) VALUES (?, ?, ?, ?)';
    db.query(insertQuery, [mac_address, fecha, hora, ID_Dispositivo], (err, result) => {
        if (err) {
            console.error('Error al insertar los datos en la base de datos:', err);
            return res.status(500).send('Error al insertar los datos en la base de datos');
        }
        console.log('Datos insertados correctamente:', { mac_address, fecha, hora, ID_Dispositivo });
        res.status(200).send('Imagen recibida y almacenada temporalmente');
    });
});

// Ruta para visualizar la imagen recibida
router.post('/ver-imagen', (req, res) => {
    const { userId: ID_Usuario, deviceId: ID_Dispositivo } = req.body;

    if (!ID_Usuario || !ID_Dispositivo) {
        console.error('Faltan datos requeridos');
        return res.status(400).send('Faltan datos requeridos');
    }

    // Verificar si el usuario está autorizado para ver la imagen
    const authQuery = `
        SELECT * 
        FROM Usuario u
        JOIN recursos r ON u.id = r.ID_USER
        JOIN Dispositivo d ON r.ID_Dispositivo = d.ID_Dispositivo
        WHERE u.id = ? AND d.ID_Dispositivo = ?
    `;
    db.query(authQuery, [ID_Usuario, ID_Dispositivo], (err, authResult) => {
        if (err) {
            console.error('Error al verificar la autorización del usuario:', err);
            return res.status(500).send('Error al verificar la autorización del usuario');
        }

        if (authResult.length === 0) {
            console.error('Usuario no autorizado');
            return res.status(403).send('Usuario no autorizado');
        }

        // Devolver la imagen en formato base64 desde la memoria
        const imageData = imageStore[ID_Dispositivo];
        if (!imageData || imageData.images.length === 0) {
            console.error('No se encontró ninguna imagen');
            return res.status(404).send('No se encontró ninguna imagen');
        }

        res.status(200).send({ image: imageData.images[imageData.images.length - 1].guardar_fotografia });
    });
});

// Ruta para verificar el estado de la cámara
router.get('/estado-camara/:deviceId', (req, res) => {
    const { deviceId: ID_Dispositivo } = req.params;

    const imageData = imageStore[ID_Dispositivo];
    if (!imageData) {
        return res.status(404).send('No se encontró ninguna imagen para este dispositivo');
    }

    const currentTime = Date.now();
    const timeDifference = currentTime - imageData.lastReceived;

    if (timeDifference > IMAGE_EXPIRATION_TIME) {
        return res.status(200).send({ estado: 'apagada' });
    } else {
        return res.status(200).send({ estado: 'encendida' });
    }
});



// Ruta para el inicio de sesión
router.post('/login', (req, res) => {
    console.log('Datos recibidos en la solicitud:', req.body); // Mostrar en consola lo que se envía

    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        return res.status(400).send('Faltan datos requeridos');
    }

    const query = 'SELECT * FROM Usuario WHERE correo = ?';
    db.query(query, [correo], (err, results) => {
        if (err) {
            console.error('Error al consultar la base de datos:', err);
            return res.status(500).send('Error al consultar la base de datos');
        }

        if (results.length === 0) {
            return res.status(400).send('Usuario incorrecto');
        }

        const user = results[0];
        if (user.contrasena !== contrasena) {
            return res.status(400).send('Contraseña incorrecta');
        }

        res.status(200).send({ message: 'Usuario correcto', id: user.id });
    });
});


// Ruta para registrar un nuevo usuario
router.post('/register', (req, res) => {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        const response = { message: 'Faltan datos requeridos' };
        return res.status(400).json(response);
    }

    // Verificar si el correo ya existe
    const checkQuery = 'SELECT * FROM Usuario WHERE correo = ?';
    db.query(checkQuery, [correo], (err, results) => {
        if (err) {
            const response = { message: 'Error al consultar la base de datos' };
            console.error('Error al consultar la base de datos:', err);
            return res.status(500).json(response);
        }

        if (results.length > 0) {
            const response = { message: 'El correo ya está registrado' };
            console.log('Respuesta enviada:', response);
            return res.status(400).json(response);
        }

        // Insertar el nuevo usuario
        const insertQuery = 'INSERT INTO Usuario (correo, contrasena) VALUES (?, ?)';
        db.query(insertQuery, [correo, contrasena], (err, result) => {
            if (err) {
                const response = { message: 'Error al registrar el usuario' };
                console.error('Error al registrar el usuario:', err);
                return res.status(500).json(response);
            }

            const userId = result.insertId;
            const response = { message: 'Usuario creado correctamente', id: userId };
            console.log('Respuesta enviada:', response);
            res.status(200).json(response);
        });
    });
});


// Ruta para obtener los dispositivos de un usuario
router.get('/dispositivos/:id', (req, res) => {
    const userId = req.params.id;

    const query = `
        SELECT d.ID_Dispositivo, d.Nombre AS NombreDispositivo, td.NombreTipo 
        FROM Dispositivo d
        JOIN recursos r ON d.ID_Dispositivo = r.ID_Dispositivo
        JOIN TipoDispositivo td ON d.ID_Tipo = td.ID_Tipo
        WHERE r.ID_USER = ?
    `;
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error al consultar la base de datos:', err);
            return res.status(500).send('Error al consultar la base de datos');
        }

        if (results.length === 0) {
            return res.status(200).send('No tiene dispositivo');
        }

        res.status(200).send(results);
    });
});

// Ruta para obtener la información de un dispositivo por ID
router.get('/recursocamara/:id', (req, res) => {
    const dispositivoId = req.params.id;

    const query = `
        SELECT c.ID_Dispositivo, c.guardar_fotografia, c.fecha, c.hora, d.Nombre AS NombreDispositivo
        FROM Camara c
        JOIN Dispositivo d ON c.ID_Dispositivo = d.ID_Dispositivo
        WHERE c.ID_Dispositivo = ?
        ORDER BY c.fecha DESC, c.hora DESC
        LIMIT 1
    `;
    db.query(query, [dispositivoId], (err, results) => {
        if (err) {
            console.error('Error al consultar la base de datos:', err);
            return res.status(500).send('Error al consultar la base de datos');
        }

        if (results.length === 0) {
            return res.status(200).send('No hay imagen');
        }
        console.log('Respuesta enviada:', results[0]);
        res.status(200).send(results[0]);
    });
});

// Ruta para obtener la información del usuario y la cantidad de dispositivos que tiene
router.get('/usuario/:id', (req, res) => {
    const userId = req.params.id;

    const query = `
        SELECT u.correo, u.contrasena, COUNT(d.ID_Dispositivo) AS cantidad_dispositivos
        FROM Usuario u
        LEFT JOIN recursos r ON u.id = r.ID_USER
        LEFT JOIN Dispositivo d ON r.ID_Dispositivo = d.ID_Dispositivo
        WHERE u.id = ?
        GROUP BY u.id
    `;
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error al consultar la base de datos:', err);
            return res.status(500).send('Error al consultar la base de datos');
        }

        if (results.length === 0) {
            return res.status(200).send('No se encontraron dispositivos para este usuario');
        }

        res.status(200).send(results[0]);
    });
});

// Ruta para agregar un dispositivo a un usuario
router.post('/agregar-dispositivo', (req, res) => {
    const { userId, nombreDispositivo, contrasenaDispositivo } = req.body;

    if (!userId || !nombreDispositivo || !contrasenaDispositivo) {
        const response = { message: 'Faltan datos requeridos' };
        console.log('Respuesta enviada:', response);
        return res.status(400).json(response);
    }

    // Verificar si el dispositivo ya está registrado en recursos para el usuario
    const checkQuery = `
        SELECT * FROM recursos r
        JOIN Dispositivo d ON r.ID_Dispositivo = d.ID_Dispositivo
        WHERE r.ID_USER = ? AND d.Nombre = ?
    `;
    db.query(checkQuery, [userId, nombreDispositivo], (err, results) => {
        if (err) {
            const response = { message: 'Error al consultar la base de datos' };
            console.error('Error al consultar la base de datos:', err);
            console.log('Respuesta enviada:', response);
            return res.status(500).json(response);
        }

        if (results.length > 0) {
            const response = { message: 'El dispositivo ya está registrado para este usuario' };
            console.log('Respuesta enviada:', response);
            return res.status(400).json(response);
        }

        // Verificar si el nombre y la contraseña del dispositivo coinciden
        const verifyQuery = 'SELECT * FROM Dispositivo WHERE Nombre = ? AND Contrasena = ?';
        db.query(verifyQuery, [nombreDispositivo, contrasenaDispositivo], (err, results) => {
            if (err) {
                const response = { message: 'Error al consultar la base de datos' };
                console.error('Error al consultar la base de datos:', err);
                console.log('Respuesta enviada:', response);
                return res.status(500).json(response);
            }

            if (results.length === 0) {
                const response = { message: 'Nombre o contraseña del dispositivo incorrectos' };
                console.log('Respuesta enviada:', response);
                return res.status(400).json(response);
            }

            const dispositivoId = results[0].ID_Dispositivo;

            // Agregar el dispositivo a la tabla recursos
            const insertQuery = 'INSERT INTO recursos (ID_Dispositivo, ID_USER) VALUES (?, ?)';
            db.query(insertQuery, [dispositivoId, userId], (err, result) => {
                if (err) {
                    const response = { message: 'Error al insertar los datos en la base de datos' };
                    console.error('Error al insertar los datos en la base de datos:', err);
                    console.log('Respuesta enviada:', response);
                    return res.status(500).json(response);
                }

                const response = { message: 'Dispositivo agregado correctamente' };
                console.log('Respuesta enviada:', response);
                res.status(200).json(response);
            });
        });
    });
});


// Ruta para recibir el mac address, el índice de calidad de aire y el ID del dispositivo
router.post('/monitoreo-aire', (req, res) => {
    const { mac_address, indice_calidad_aire, ID_Dispositivo } = req.body;

    console.log('Datos recibidos:', { mac_address, indice_calidad_aire, ID_Dispositivo });

    if (!mac_address || !indice_calidad_aire || !ID_Dispositivo) {
        const response = { message: 'Faltan datos requeridos' };
        console.log('Respuesta enviada:', response);
        return res.status(400).json(response);
    }

    const fecha = moment().tz('America/Guatemala').format('YYYY-MM-DD');
    const hora = moment().tz('America/Guatemala').format('HH:mm:ss');

    // Insertar los datos en la tabla MonitoreoDeAire
    const insertQuery = 'INSERT INTO MonitoreoDeAire (mac_address, indice_calidad_aire, fecha, hora, ID_Dispositivo) VALUES (?, ?, ?, ?, ?)';
    db.query(insertQuery, [mac_address, indice_calidad_aire, fecha, hora, ID_Dispositivo], (err, result) => {
        if (err) {
            const response = { message: 'Error al insertar los datos en la base de datos' };
            console.error('Error al insertar los datos en la base de datos:', err);
            console.log('Respuesta enviada:', response);
            return res.status(500).json(response);
        }

        const response = { message: 'Datos insertados correctamente' };
        console.log('Respuesta enviada:', response);
        res.status(200).json(response);
    });
});


// Ruta para obtener el índice de calidad de aire, fecha, hora y nombre del dispositivo en base al ID del usuario
router.get('/calidad-aire/:userId', (req, res) => {
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
    db.query(query, [userId], (err, results) => {
        if (err) {
            const response = { message: 'Error al consultar la base de datos' };
            console.error('Error al consultar la base de datos:', err);
            console.log('Respuesta enviada:', response);
            return res.status(500).json(response);
        }

        if (results.length === 0) {
            const response = { message: 'No se encontraron datos de calidad de aire para este usuario' };
            console.log('Respuesta enviada:', response);
            return res.status(500).json(response);
        }

        const response = results[0];
        console.log('Respuesta enviada:', response);
        res.status(200).json(response);
    });
});

// Ruta para obtener el promedio de calidad de aire por hora, la fecha y la hora en base al ID del usuario
router.get('/promedio-calidad-aire/:userId', (req, res) => {
    const userId = req.params.userId;
    const today = moment().tz('America/Guatemala').format('YYYY-MM-DD'); // Obtener la fecha actual en la zona horaria de Guatemala

    const query = `
        SELECT DATE(m.fecha) AS fecha, HOUR(m.hora) AS hora, AVG(m.indice_calidad_aire) AS promedio_calidad_aire
        FROM MonitoreoDeAire m
        JOIN Dispositivo d ON m.ID_Dispositivo = d.ID_Dispositivo
        JOIN recursos r ON d.ID_Dispositivo = r.ID_Dispositivo
        WHERE r.ID_USER = ? AND DATE(m.fecha) = ?
        GROUP BY DATE(m.fecha), HOUR(m.hora)
        ORDER BY fecha DESC, hora DESC
    `;
    db.query(query, [userId, today], (err, results) => {
        if (err) {
            const response = { message: 'Error al consultar la base de datos' };
            console.error('Error al consultar la base de datos:', err);
            console.log('Respuesta enviada:', response);
            return res.status(500).json(response);
        }

        if (results.length === 0) {
            const response = { message: 'No se encontraron datos de calidad de aire para este usuario' };
            console.log('Respuesta enviada:', response);
            return res.status(200).json(response);
        }

        const response = results;
        console.log('Respuesta enviada:', response);
        res.status(200).json(response);
    });
});


// Ruta para recibir el mac address, la temperatura y el ID del dispositivo
router.post('/sensor-temperatura', (req, res) => {
    const { mac_address, temperatura, ID_Dispositivo } = req.body;

    console.log('Datos recibidos:', { mac_address, temperatura, ID_Dispositivo });

    if (!mac_address || !temperatura || !ID_Dispositivo) {
        const response = { message: 'Faltan datos requeridos' };
        console.log('Respuesta enviada:', response);
        return res.status(400).json(response);
    }

    const fecha = moment().tz('America/Guatemala').format('YYYY-MM-DD');
    const hora = moment().tz('America/Guatemala').format('HH:mm:ss');

    // Insertar los datos en la tabla SensorDeTemperatura
    const insertQuery = 'INSERT INTO SensorDeTemperatura (mac_address, temperatura, fecha, hora, ID_Dispositivo) VALUES (?, ?, ?, ?, ?)';
    db.query(insertQuery, [mac_address, temperatura, fecha, hora, ID_Dispositivo], (err, result) => {
        if (err) {
            const response = { message: 'Error al insertar los datos en la base de datos' };
            console.error('Error al insertar los datos en la base de datos:', err);
            console.log('Respuesta enviada:', response);
            return res.status(500).json(response);
        }

        const response = { message: 'Datos insertados correctamente' };
        console.log('Respuesta enviada:', response);
        res.status(200).json(response);
    });
});


// Ruta para obtener el nombre del dispositivo, la temperatura, la fecha y la hora en base al ID del usuario
router.get('/temperatura/:userId', (req, res) => {
    const userId = req.params.userId;

    const query = `
        SELECT s.temperatura, s.fecha, s.hora, d.Nombre AS NombreDispositivo
        FROM SensorDeTemperatura s
        JOIN Dispositivo d ON s.ID_Dispositivo = d.ID_Dispositivo
        JOIN recursos r ON d.ID_Dispositivo = r.ID_Dispositivo
        WHERE r.ID_USER = ?
        ORDER BY s.fecha DESC, s.hora DESC
        LIMIT 1
    `;
    db.query(query, [userId], (err, results) => {
        if (err) {
            const response = { message: 'Error al consultar la base de datos' };
            console.error('Error al consultar la base de datos:', err);
            console.log('Respuesta enviada:', response);
            return res.status(500).json(response);
        }

        if (results.length === 0) {
            const response = { message: 'No se encontraron datos de temperatura para este usuario' };
            console.log('Respuesta enviada:', response);
            return res.status(200).json(response);
        }

        const response = results[0];
        console.log('Respuesta enviada:', response);
        res.status(200).json(response);
    });
});


// Ruta para obtener el promedio de temperatura por hora, la fecha y la hora en base al ID del usuario
router.get('/promedio-temperatura/:userId', (req, res) => {
    const userId = req.params.userId;
    const today = moment().tz('America/Guatemala').format('YYYY-MM-DD'); // Obtener la fecha actual en la zona horaria de Guatemala

    const query = `
        SELECT DATE(s.fecha) AS fecha, HOUR(s.hora) AS hora, AVG(s.temperatura) AS promedio_temperatura
        FROM SensorDeTemperatura s
        JOIN Dispositivo d ON s.ID_Dispositivo = d.ID_Dispositivo
        JOIN recursos r ON d.ID_Dispositivo = r.ID_Dispositivo
        WHERE r.ID_USER = ? AND DATE(s.fecha) = ?
        GROUP BY DATE(s.fecha), HOUR(s.hora)
        ORDER BY fecha DESC, hora DESC
    `;
    db.query(query, [userId, today], (err, results) => {
        if (err) {
            const response = { message: 'Error al consultar la base de datos' };
            console.error('Error al consultar la base de datos:', err);
            console.log('Respuesta enviada:', response);
            return res.status(500).json(response);
        }

        if (results.length === 0) {
            const response = { message: 'No se encontraron datos de temperatura para este usuario' };
            console.log('Respuesta enviada:', response);
            return res.status(200).json(response);
        }

        const response = results;
        console.log('Respuesta enviada:', response);
        res.status(200).json(response);
    });
});

router.delete('/eliminar-recurso', (req, res) => {
    const { ID_Dispositivo, ID_USER } = req.body;

    console.log('Datos recibidos:', { ID_Dispositivo, ID_USER });

    if (!ID_Dispositivo || !ID_USER) {
        const response = { message: 'Faltan datos requeridos' };
        console.log('Respuesta enviada:', response);
        return res.status(400).json(response);
    }

    // Eliminar el registro de la tabla recursos
    const deleteQuery = 'DELETE FROM recursos WHERE ID_Dispositivo = ? AND ID_USER = ?';
    db.query(deleteQuery, [ID_Dispositivo, ID_USER], (err, result) => {
        if (err) {
            const response = { message: 'Error al eliminar el registro en la base de datos' };
            console.error('Error al eliminar el registro en la base de datos:', err);
            console.log('Respuesta enviada:', response);
            return res.status(500).json(response);
        }

        if (result.affectedRows === 0) {
            const response = { message: 'No se encontró el registro para eliminar' };
            console.log('Respuesta enviada:', response);
            return res.status(404).json(response);
        }

        const response = { message: 'Registro eliminado correctamente' };
        console.log('Respuesta enviada:', response);
        res.status(200).json(response);
    });
});


// Ruta para obtener solo la temperatura más reciente de un dispositivo específico basado en el ID del usuario
router.get('/ver-temperatura/:userId', (req, res) => {
    const { userId: ID_Usuario } = req.params;

    const query = `
        SELECT st.temperatura 
        FROM SensorDeTemperatura st
        JOIN recursos r ON st.ID_Dispositivo = r.ID_Dispositivo
        WHERE r.ID_USER = ?
        ORDER BY CONCAT(st.fecha, ' ', st.hora) DESC 
        LIMIT 1
    `;
    db.query(query, [ID_Usuario], (err, result) => {
        if (err) {
            console.error('Error al obtener la temperatura:', err);
            return res.status(500).send('Error al obtener la temperatura');
        }

        if (result.length === 0) {
            return res.status(404).send('No se encontró ninguna temperatura para este usuario');
        }

        res.status(200).send({ temperatura: result[0].temperatura });
    });
});

// Ruta para obtener solo la calidad del aire más reciente de un dispositivo específico basado en el ID del usuario
router.get('/ver-calidad-aire/:userId', (req, res) => {
    const { userId: ID_Usuario } = req.params;

    const query = `
        SELECT ma.indice_calidad_aire 
        FROM MonitoreoDeAire ma
        JOIN recursos r ON ma.ID_Dispositivo = r.ID_Dispositivo
        WHERE r.ID_USER = ?
        ORDER BY CONCAT(ma.fecha, ' ', ma.hora) DESC 
        LIMIT 1
    `;
    db.query(query, [ID_Usuario], (err, result) => {
        if (err) {
            console.error('Error al obtener la calidad del aire:', err);
            return res.status(500).send('Error al obtener la calidad del aire');
        }

        if (result.length === 0) {
            return res.status(404).send('No se encontró ninguna calidad del aire para este usuario');
        }

        res.status(200).send({ indice_calidad_aire: result[0].indice_calidad_aire });
    });
});




module.exports = router;