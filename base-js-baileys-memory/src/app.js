import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import path from 'path';
import fs from 'fs';
import moment from 'moment';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const menuPath = path.join(__dirname, "../Notes", "welcome.txt");
const menu = fs.readFileSync(menuPath, "utf-8");
import pkg from 'pg';
const { Client } = pkg;
import { keywords } from '../Keywords/catKeywords.js';
import { foodKeywords } from '../Keywords/tiprestKeywords.js';



const PORT = process.env.PORT ?? 3008

const client = new Client({
    host: 'localhost', //process.env.PG_HOST,
    user: 'postgres',//process.env.PG_USER,
    password: 'postgres',//process.env.PG_PASSWORD,
    database: 'pruebados',//process.env.PG_DATABASE,
    port: '5432' //process.env.PG_PORT
});

function validarCorreo(correo) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(correo);
}

const enviarMailReserva = async (emailDestino, nombreCliente, detallesReserva) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'camospinac@gmail.com',
            pass: 'aosf oksx szfg ywib'
        }
    });
    const detallesHTML = detallesReserva
        .split('\n')
        .map(linea => {
            return `<p>${linea.replace(/\*(.*?)\*/g, '<strong>$1</strong>')}</p>`;
        })
        .join('');

    const mailOptions = {
        from: '"Turisbot 🤖☀️ By Camilo Ospina" <camospinac@gmail.com>',
        to: emailDestino,
        subject: 'Confirmación de tu reserva',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #f09e51;">Hola ${nombreCliente},</h2>
                <p>Gracias por tu reserva, recuerda llegar con 10 minutos de anticipación para cualquier eventualidad, disfruta y aquí tienes los detalles:</p>
                ${detallesHTML} <!-- Aquí se inserta el contenido dinámico -->
                <p>¡Saludos!</p>
                <p><strong>Turisbot 🤖☀️ by Camilo Ospina</strong></p>
            </div>
        `
    };
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Correo enviado: ' + info.response);
    } catch (error) {
        console.error('Error al enviar el correo: ', error);
    }
};


const validarFecha = (fecha) => {
    if (!moment(fecha, 'YYYY-MM-DD', true).isValid()) {
        return { valido: false, mensaje: 'El formato de la fecha no es válido o la fecha no existe 😔\n_Vuelve a escribir la fecha, recuerda que el formato adecuado es AAAA-MM-DD_' };
    }
    if (moment(fecha).isBefore(moment().startOf('day'))) {
        return { valido: false, mensaje: 'La fecha no puede ser anterior a hoy 😔\n_Vuelve a escribir la fecha, recuerda que el formato adecuado es AAAA-MM-DD_' };
    }
    return { valido: true };
}

client.connect();

const flowMenuRest = addKeyword([EVENTS.ACTION])
    .addAnswer('Escribe el nombre del restaurante que deseas obtener más información 🤗', { capture: true }, async (ctx, { flowDynamic, gotoFlow, state }) => {
        const nomResta = ctx.body.toUpperCase();
        try {
            const query = `SELECT ruta_menu, titulo, direccion, num_contacto, codigo_sitio FROM sitios_turisticos WHERE codigo_categoria = $1 AND UPPER(titulo) LIKE $2`;
            const res = await client.query(query, ['RES', `%${nomResta}%`]);
            if (res.rows.length > 0) {
                for (const row of res.rows) {
                    const { ruta_menu, titulo, direccion, num_contacto, codigo_sitio } = row;
                    const message = `*${titulo}*\n📲 ${num_contacto}\n📌 ${direccion}`;
                    await state.update({ sitio: codigo_sitio });
                    await flowDynamic([{
                        body: message,
                        media: ruta_menu,
                    }]);
                }
                return gotoFlow(flowDespRest);
            } else {
                await flowDynamic("No hay carta disponible para el restaurante seleccionado en este momento.");
            }
        } catch (err) {
            console.error("Error al recuperar la carta del restaurante: ", err);
            await flowDynamic("Ocurrió un error al recuperar la carta del restaurante.");
        }
    });

const flowReservaRest = addKeyword(['reservar', 'reserva'])
    .addAnswer('Por favor, dime tu nombre completo 🤓', { capture: true }, async (ctx, { flowDynamic, state }) => {
        const nombre = ctx.body;
        console.log('Nombre del cliente:', nombre);
        ctx.nombreCliente = nombre;
        await state.update({ nombreCliente: nombre });
        await flowDynamic('¿Cuántos comensales son 👥?');
    })


    .addAnswer('', { capture: true }, async (ctx, { flowDynamic, state, fallBack }) => {
        const textoUsuario = ctx.body;
        console.log('Respuesta del usuario:', textoUsuario);
        const numerosEncontrados = textoUsuario.match(/\d+/g);
        if (numerosEncontrados) {
            const cantidadComensales = numerosEncontrados.map(Number).reduce((acc, num) => acc + num, 0);
            console.log('Cantidad de comensales calculada:', cantidadComensales);
            await state.update({ comensal: cantidadComensales });
            await flowDynamic('Por favor, indícame tu correo electrónico 📧');
        } else {
            return fallBack('Por favor, indícame cuántas personas son (en números).');
        }
    })

    .addAnswer('', { capture: true }, async (ctx, { flowDynamic, state, fallBack }) => {
        const correo = ctx.body;
        console.log('Correo electrónico:', correo);
        ctx.correoCliente = correo;
        if (validarCorreo(correo)) {
            await state.update({ correo: correo });
            await flowDynamic('Por favor escribe la fecha en la que quieras reservar 📅')
            await flowDynamic('_El formato de la fecha debe ser: AAAA-MM-DD_ 🤓');
        } else {
            return fallBack('Correo no valido 😔\n_El formato de correo debe ser ejemplo@mail.com_ 🤓');
        }

    })

    .addAnswer('', { capture: true }, async (ctx, { flowDynamic, state, fallBack }) => {
        const fechaRes = ctx.body;
        const validacion = validarFecha(fechaRes);
        console.log('Fecha reserva: ', fechaRes);

        if (!validacion.valido) {
            return fallBack(validacion.mensaje);
        } else {
            ctx.fechaReserva = fechaRes;
            const codRes = state.get('sitio');
            await state.update({ fechaRese: fechaRes });
            try {
                const queryHoras = `
                    SELECT h.id_horario, h.hora_inicio, h.hora_fin 
                    FROM horarios h
                    WHERE h.cod_res = $1
                    AND h.id_horario NOT IN (
                        SELECT r.id_horario
                        FROM reservas r
                        WHERE r.fecha = $2
                        AND r.cod_rest_res = $3
                    )
                    ORDER BY h.id_horario ASC;
                `;
                const resHoras = await client.query(queryHoras, [codRes, fechaRes, codRes]);
                await flowDynamic('Por favor, selecciona uno de los horarios ⌛');
                if (resHoras.rows.length > 0) {
                    let mensajeHora = '📅 Horarios disponibles para el ' + fechaRes + '\n';
                    resHoras.rows.forEach(hora => {
                        mensajeHora += `${hora.id_horario} - Hora: ${hora.hora_inicio} a ${hora.hora_fin} 🕒\n`;
                    });
                    await flowDynamic(mensajeHora);
                } else {
                    await flowDynamic('No hay horarios disponibles para la fecha seleccionada.');
                }
            } catch (err) {
                console.error("Error al recuperar los horarios: ", err);
                await flowDynamic('Ocurrió un error al consultar los horarios.');
            }
        }
    })

    .addAnswer('', { capture: true }, async (ctx, { flowDynamic, state }) => {
        const horario = ctx.body;
        const codRes = state.get('sitio');
        const capacidad = state.get('comensal');
        const fechaRes = state.get('fechaRese');
        const nombreRes = state.get('nombreCliente');
        const emailReserva = state.get('correo');
        await state.update({ horarior: horario });
        try {
            const queryDispo = `
                SELECT m.id_mesa
                FROM mesas m
                WHERE m.codigo_sitio = $1 
                AND capacidad >= $2 
                AND m.id_mesa NOT IN (
                    SELECT r.id_mesa
                    FROM reservas r
                    WHERE r.id_horario = $3 
                    AND r.fecha = $4
                )
                LIMIT 1;
            `;
            const resReserva = await client.query(queryDispo, [codRes, capacidad, horario, fechaRes]);
            if (resReserva.rows.length > 0) {
                const idMesaRes = resReserva.rows[0].id_mesa;
                try {
                    const queryHorario = `
                        SELECT h.hora_inicio, h.hora_fin
                        FROM horarios h
                        WHERE h.id_horario = $1
                        AND h.cod_res = $2;
                    `;
                    const resHorario = await client.query(queryHorario, [horario, codRes]);
                    if (resHorario.rows.length > 0) {
                        const horaInicio = resHorario.rows[0].hora_inicio;
                        const horaFin = resHorario.rows[0].hora_fin;
                        const horarioTexto = `${horaInicio} - ${horaFin}`;
                        const queryReserva = `
                            INSERT INTO reservas (id_mesa, id_horario, fecha, nombre_cliente, telefono_cliente, estado, correo, cod_rest_res)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
                        `;
                        await client.query(queryReserva, [idMesaRes, horario, fechaRes, nombreRes, '8323230', 'Reservado', emailReserva, codRes]);
                        await state.update({ mesa: idMesaRes });
                        const msjConfReserva = `*Nombre:* ${nombreRes}\n*Comensales:* ${capacidad}\n*Email:* ${emailReserva}\n*Fecha reserva:* ${fechaRes}\n*Horario:* ${horarioTexto}\n*Mesa:* ${idMesaRes}`;
                        console.log('Mensaje enviado: ', msjConfReserva);
                        await flowDynamic('A continuación los datos de tu reserva:');
                        await flowDynamic(msjConfReserva);
                        await flowDynamic('Reserva guardada con éxito, verifica tu correo para más detalles, atendido por TurisBot 🤖');
                        await enviarMailReserva(emailReserva, nombreRes, msjConfReserva);
                    } else {
                        await flowDynamic('No se pudo encontrar el horario seleccionado.');
                    }
                } catch (err) {
                    console.error("Error al guardar la reserva: ", err);
                    await flowDynamic('Ocurrió un error al guardar la reserva.');
                }
            } else {
                await flowDynamic('No hay disponibilidad de mesas en este momento.');
            }
        } catch (err) {
            console.error("Error al consultar las mesas: ", err);
            await flowDynamic('Ocurrió un error al consultar las mesas.');
        }
    });

const flowDespRest = addKeyword([EVENTS.ACTION])
    .addAnswer('¿Deseas reservar en este restaurante? 🤔\nEscribe *SI* ✅ o *NO* ❌', { capture: true }, async (ctx, { flowDynamic, fallBack, gotoFlow }) => {
        const resReserva = ctx.body;
        if (!["si", "no"].includes(resReserva.toLocaleLowerCase())) {
            return fallBack('Debes escribir *SI* ✅ o *NO* ❌')
        } else {
            if (resReserva.toLocaleLowerCase() === 'si') {
                return gotoFlow(flowReservaRest)
            } else {
                return gotoFlow(menuFlow)
            }
        }
    });

const flowOpcionRest = addKeyword([EVENTS.ACTION])
    .addAnswer('¿Deseas más información acerca de un restaurante? 🤔\nEscribe *SI* ✅ o *NO* ❌', { capture: true }, async (ctx, { flowDynamic, gotoFlow, fallBack }) => {
        const resOpCres = ctx.body;
        if (!["si", "no"].includes(resOpCres.toLocaleLowerCase())) {
            return fallBack('Debes escribir *SI* ✅ o *NO* ❌')
        } else {
            if (resOpCres.toLocaleLowerCase() === 'si') {
                return gotoFlow(flowMenuRest)
            } else {
                return gotoFlow(menuFlow)
            }
        }
    });

const flowSelRest = addKeyword([EVENTS.ACTION])
    .addAnswer(' _Escribe la opción que te apetece_ 😋', { capture: true }, async (ctx, { flowDynamic, gotoFlow, fallBack }) => {
        const tipoSeleccionado = checkKeywordsRest(ctx.body);
        if (tipoSeleccionado === null) {
            return fallBack("No te entendí, por favor dime una palabra clave nuevamente.");
        }
        try {
            const query = 'SELECT homocodres, ruta_foto, titulo, descripcion, direccion FROM sitios_turisticos WHERE codigo_categoria = $1 AND ctipres = $2';
            const res = await client.query(query, ['RES', parseInt(tipoSeleccionado)]);
            if (res.rows.length > 0) {
                for (const row of res.rows) {
                    const { homocodres, ruta_foto, titulo, descripcion, direccion } = row;
                    const message = `*${titulo}*\n${descripcion}\n_Dirección: ${direccion}_`;
                    await flowDynamic([{
                        body: message,
                        media: ruta_foto,
                    }]);
                }
                return gotoFlow(flowOpcionRest)
            } else {
                await flowDynamic("No hay restaurantes disponibles para el tipo seleccionado en este momento.");
            }
        } catch (err) {
            console.error("Error al recuperar los restaurantes: ", err);
            await flowDynamic("Ocurrió un error al recuperar los restaurantes.");
        }
    });

const flowSitiosT = addKeyword([EVENTS.ACTION])
    .addAnswer('☀️ *BIENVENIDO A GIRARDOT* ☀️\nConoce sus maravillosos sitios turisticos 😎', {}, async (ctx, { flowDynamic, gotoFlow }) => {
        try {
            const query = 'SELECT ruta_foto, titulo, descripcion, direccion FROM sitios_turisticos WHERE codigo_categoria = $1';
            const res = await client.query(query, ['CUL']);
            if (res.rows.length > 0) {
                for (const row of res.rows) {
                    const { ruta_foto, titulo, descripcion, direccion } = row;
                    const message = `*${titulo}*\n${descripcion}\n_Dirección: ${direccion}_`;
                    await flowDynamic([{
                        body: message,
                        media: ruta_foto,
                    }]);
                }
                await flowDynamic("Estos son algunos de los sitios más emblemáticos y turísticos de la ciudad ☀️☀️");
                return gotoFlow(menuFlow);
            } else {
                console.log("No hay sitios turísticos disponibles para la categoría CUL.");
                await flowDynamic("No hay sitios turísticos disponibles con el código 'CUL' en este momento.");
            }
        } catch (err) {
            console.error("Error al realizar la consulta: ", err);
            await flowDynamic("Ocurrió un error al recuperar los sitios turísticos.");
        }
    });

const flowCatRest = addKeyword([EVENTS.ACTION])
    .addAnswer('Claro que si, acá en Girardot tenemos opciones apra todos los gustos 😋 \n*¿Qué deseas comer?* 🤔', {}, async (ctx, { flowDynamic, gotoFlow }) => {
        try {
            const tipoQuery = 'SELECT id, t_descripcion FROM tipo_restaurante WHERE t_estado = $1';
            const tipoRes = await client.query(tipoQuery, ['A']);
            if (tipoRes.rows.length > 0) {
                let tiposMensaje = '';
                const opciones = [];
                for (const tipo of tipoRes.rows) {
                    tiposMensaje += `${tipo.t_descripcion}\n`;
                    opciones.push(tipo.id.toString());
                }
                await flowDynamic(tiposMensaje);
                return gotoFlow(flowSelRest)
            } else {
                await flowDynamic("No hay tipos de restaurantes disponibles en este momento.");
            }
        } catch (err) {
            console.error("Error en la consulta SQL:", err);
            await flowDynamic("Ocurrió un error al recuperar los tipos de restaurantes.");
        }
    });


function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radio de la Tierra en metros
    const rad = Math.PI / 180; // Constante para convertir a radianes
    const φ1 = lat1 * rad;
    const φ2 = lat2 * rad;
    const Δφ = (lat2 - lat1) * rad;
    const Δλ = (lon2 - lon1) * rad;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distancia = R * c; // Distancia en metros
    return distancia;
}

const restaurantes = [ , 
    { nombre: 'Restaurante Bogotá - La Ola del Sabor', latitud: 4.686004341626013, longitud: -74.15551206255613 },
    { nombre: 'Restaurante Bogotá - Glotones de la 133', latitud: 4.693565556079797, longitud: -74.16788791154858 },
    { nombre: 'Restaurante Bogotá - Tres Gourmet', latitud: 4.696324323950352, longitud: -74.15840334291411 },
    { nombre: 'Restaurante Girardot - Michael Burguer', latitud: 4.302858537469106, longitud: -74.80819906472283 },
    { nombre: 'Restaurante Girardot - Tamaleria Doña Rubiela', latitud: 4.300613837984341, longitud: -74.81133212851658 },
]; 

function obtenerRestaurantesCercanos(restaurantes, latUsuario, lonUsuario, radioEnMetros) {
    return restaurantes.filter(restaurante => {
        const distancia = calcularDistancia(latUsuario, lonUsuario, restaurante.latitud, restaurante.longitud);
        return distancia <= radioEnMetros;
    });
}


const locationReal = addKeyword([EVENTS.LOCATION])
    .addAnswer('Por favor enviame tu ubicación: ', { capture: true }, async (ctx, { flowDynamic, gotoFlow }) => {
        const userLatitude = ctx.message.locationMessage.degreesLatitude;
        const userLongitude = ctx.message.locationMessage.degreesLongitude;
        console.log('Longitud: ', userLongitude);
        console.log('Altitud: ', userLatitude);
        const msjLocation = `Tus coordenadas\nLongitud: ${userLongitude}\nAltitud: ${userLatitude}`;

        const urlOpen = `https://www.openstreetmap.org/#map=19/${userLatitude}/${userLongitude}`;
        await flowDynamic(msjLocation);
        await flowDynamic(urlOpen);

        const radioBusqueda = 3000; // Define el radio de búsqueda en metros (1km en este caso)
        const restaurantesCercanos = obtenerRestaurantesCercanos(restaurantes, userLatitude, userLongitude, radioBusqueda);

        // Si encuentra restaurantes cercanos, los muestra, de lo contrario, muestra un mensaje de no encontrados
        if (restaurantesCercanos.length > 0) {
            await flowDynamic('Restaurantes cercanos a ti:');
            for (const restaurante of restaurantesCercanos) {
                await flowDynamic(`- ${restaurante.nombre}`);
            }
        } else {
            await flowDynamic('No se encontraron restaurantes cercanos en tu área.');
        }
    });




const LocationFlow = addKeyword([EVENTS.ACTION])
    .addAnswer('Hola!\nPara proporcionarte una mejor experiencia envianos tu ubicación\n_Al enviarnos tu ubicación aceptas la politica de tratamiento de datos_ https://shorturl.at/JRQee', {}, async (ctx, { flowDynamic, gotoFlow }) => {
        return gotoFlow(locationReal)
    });
const checkKeywords = (userInput) => {
    userInput = userInput.toLowerCase();
    for (const key in keywords) {
        const keywordList = keywords[key];
        for (const keyword of keywordList) {
            if (userInput.includes(keyword.toLowerCase())) {
                return key;
            }
        }
    }
    return null;
};

const checkKeywordsRest = (userInput) => {
    userInput = userInput.toLowerCase();
    for (const key in foodKeywords) {
        const keywordList = foodKeywords[key];
        for (const keyword of keywordList) {
            if (userInput.includes(keyword.toLowerCase())) {
                return key;
            }
        }
    }
    return null;
};


const menuFlow = addKeyword(['MENU', 'Menu', 'menu', 'Menú', 'menú', 'MENÚ']).addAnswer(
    menu,
    { capture: true },
    async (ctx, { gotoFlow, fallBack, flowDynamic }) => {
        const matchedOption = checkKeywords(ctx.body);

        if (matchedOption === null) {
            return fallBack("No te entendí, por favor dime una palabra clave nuevamente.");
        }
        switch (matchedOption) {
            case "1":
                return gotoFlow(flowSitiosT);
            case "2":
                return gotoFlow(flowCatRest);
            case "3":
                return gotoFlow(LocationFlow)
            case "4":
                return await flowDynamic("Hoteles");
            case "5":
                return await flowDynamic("Piscinas");
            case "6":
                return await flowDynamic("Pregunta algo");
            case "0":
                return await flowDynamic("🏃 Saliendo... Puedes volver a acceder a este menú escribiendo *menu*");
        }
    }
);


const welcomeFlow = addKeyword(['hi', 'hello', 'hola', 'holi', 'ola', 'holanda', 'holiwi', 'holis'])
    .addAnswer(`☀️☀️ Holaaa soy TurisBot y te doy la bienvenida a *Girardot*, donde el verano es eterno. No olvides tu traje de baño 👙 y tus ganas de disfrutar 🏊🏼. `, {}, async (ctx, { flowDynamic, gotoFlow }) => {
        return gotoFlow(menuFlow)
    })

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, menuFlow, locationReal, LocationFlow, flowCatRest, flowSitiosT, flowSelRest, flowOpcionRest, flowMenuRest, flowReservaRest, flowDespRest])

    const adapterProvider = createProvider(Provider)
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('REGISTER_FLOW', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('SAMPLES', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    httpServer(+PORT)
}

main()
