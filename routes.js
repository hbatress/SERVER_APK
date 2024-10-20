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
    console.log('Contenido de la solicitud:', req.body);

    const { mac: mac_address, image: guardar_fotografia, id: ID_Dispositivo } = req.body;

    if (!mac_address || !guardar_fotografia || !ID_Dispositivo) {
        console.error('Faltan datos requeridos');
        return res.status(400).send('Faltan datos requeridos');
    }

    console.log('Datos recibidos:', { mac_address, guardar_fotografia, ID_Dispositivo });

    const fecha = new Date().toISOString().split('T')[0];
    const hora = new Date().toISOString().split('T')[1].split('.')[0];

    // Eliminar imágenes que tienen más de 5 segundos de antigüedad para el mismo dispositivo
    const deleteQuery = `
        DELETE FROM Camara 
        WHERE ID_Dispositivo = ? 
        AND TIMESTAMPDIFF(SECOND, CONCAT(fecha, ' ', hora), NOW()) > 5
    `;
    db.query(deleteQuery, [ID_Dispositivo], (err, result) => {
        if (err) {
            console.error('Error al eliminar las imágenes antiguas:', err);
            return res.status(500).send('Error al eliminar las imágenes antiguas');
        }

        console.log('Imágenes antiguas eliminadas:', result.affectedRows);

        // Insertar la nueva imagen
        const insertQuery = 'INSERT INTO Camara (mac_address, guardar_fotografia, fecha, hora, ID_Dispositivo) VALUES (?, ?, ?, ?, ?)';
        db.query(insertQuery, [mac_address, guardar_fotografia, fecha, hora, ID_Dispositivo], (err, result) => {
            if (err) {
                console.error('Error al insertar los datos en la base de datos:', err);
                return res.status(500).send('Error al insertar los datos en la base de datos');
            }
            console.log('Datos insertados correctamente:', { mac_address, guardar_fotografia, fecha, hora, ID_Dispositivo });
            res.status(200).send('Datos insertados correctamente');
        });
    });
});

module.exports = router;