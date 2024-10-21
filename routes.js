const express = require('express');
const router = express.Router();
const db = require('./database'); // Importar la lógica de la base de datos

// Definir rutas
router.get('/', (req, res) => {
    res.send('Bienvenido a la API');
});

// Ruta para recibir la imagen en formato base64, la MAC address y el ID del dispositivo
router.post('/video', (req, res) => {
    console.log('Solicitud POST a /camara recibida');

    const { mac: mac_address, image: guardar_fotografia, id: ID_Dispositivo } = req.body;

    if (!mac_address || !guardar_fotografia || !ID_Dispositivo) {
        console.error('Faltan datos requeridos');
        return res.status(400).send('Faltan datos requeridos');
    }

    console.log('Datos recibidos:', { mac_address, guardar_fotografia, ID_Dispositivo });

    const fecha = new Date().toISOString().split('T')[0];
    const hora = new Date().toISOString().split('T')[1].split('.')[0];

    // Insertar la nueva imagen
    const insertQuery = 'INSERT INTO Camara (mac_address, guardar_fotografia, fecha, hora, ID_Dispositivo) VALUES (?, ?, ?, ?, ?)';
    db.query(insertQuery, [mac_address, guardar_fotografia, fecha, hora, ID_Dispositivo], (err, result) => {
        if (err) {
            console.error('Error al insertar los datos en la base de datos:', err);
            return res.status(500).send('Error al insertar los datos en la base de datos');
        }
        console.log('Datos insertados correctamente:', { mac_address, guardar_fotografia, fecha, hora, ID_Dispositivo });
        res.status(200).send('Datos insertados correctamente');

        // Esperar 5 segundos antes de eliminar las imágenes antiguas
        setTimeout(() => {
            // Eliminar imágenes que tienen más de 5 segundos de antigüedad para el mismo dispositivo
            const deleteQuery = `
                DELETE FROM Camara 
                WHERE ID_Dispositivo = ? 
                AND TIMESTAMPDIFF(SECOND, CONCAT(fecha, ' ', hora), NOW()) > 5
            `;
            db.query(deleteQuery, [ID_Dispositivo], (err, result) => {
                if (err) {
                    console.error('Error al eliminar las imágenes antiguas:', err);
                    return;
                }
                console.log('Imágenes antiguas eliminadas:', result.affectedRows);
            });
        }, 5000); // Esperar 5 segundos
    });
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

module.exports = router;