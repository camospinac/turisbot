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

const enviarMailReserva = async (emailDestino, nombreCliente, detallesReserva) => {
    const transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: {
            user: 'email@mail.com',
            pass: 'password+'
        }
    });
    const mailOptions = {
        from: 'camospinac@outlook.com',
        to: emailDestino,
        subject: 'Confirmación de tu reserva',
        text: `Hola ${nombreCliente},\n\nGracias por tu reserva. Aquí tienes los detalles:\n${detallesReserva}\n\nSaludos, TurisBot - Desarrollado por Camilo Ospina.` // Cuerpo
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
        return { valido: false, mensaje: 'El formato de la fecha no es válido o la fecha no existe.' };
    }
    if (moment(fecha).isBefore(moment().startOf('day'))) {
        return { valido: false, mensaje: 'La fecha no puede ser anterior a hoy.' };
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
    .addAnswer('Por favor, dime tu nombre completo:', { capture: true }, async (ctx, { flowDynamic, state }) => {
        const nombre = ctx.body;
        console.log('Nombre del cliente:', nombre);
        ctx.nombreCliente = nombre;
        await state.update({ nombreCliente: nombre });
        await flowDynamic('¿Cuántos comensales son?');
    })
    .addAnswer('', { capture: true }, async (ctx, { flowDynamic, state }) => {
        const cantidadComensales = ctx.body;
        console.log('Cantidad de comensales:', cantidadComensales);
        ctx.cantidadComensales = cantidadComensales;
        await state.update({ comensal: cantidadComensales });
        await flowDynamic('Por favor, indícame tu correo electrónico:');
    })

    .addAnswer('', { capture: true }, async (ctx, { flowDynamic, state }) => {
        const correo = ctx.body;
        console.log('Correo electrónico:', correo);
        ctx.correoCliente = correo;
        await state.update({ correo: correo });
        await flowDynamic('Por favor escribe la fecha en la que quieras reservar:')
        await flowDynamic('_El formato de la fecha debe ser: AAAA-MM-DD_');
    })

    .addAnswer('', { capture: true }, async (ctx, { flowDynamic, state, fallBack }) => {
        const fechaRes = ctx.body;
        const validacion = validarFecha(fechaRes); // Aquí llamamos a la función de validación de fecha
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

                if (resHoras.rows.length > 0) {
                    let mensajeHora = 'Horarios disponibles para el ' + fechaRes + ':\n';
                    resHoras.rows.forEach(hora => {
                        mensajeHora += `${hora.id_horario} - Hora: ${hora.hora_inicio} a ${hora.hora_fin}\n`;
                    });
                    await flowDynamic(mensajeHora);
                } else {
                    await flowDynamic('No hay horarios disponibles para la fecha seleccionada.');
                }

                await flowDynamic('Por favor, selecciona uno de los horarios:');
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
                    const queryReserva = `
                        INSERT INTO reservas (id_mesa, id_horario, fecha, nombre_cliente, telefono_cliente, estado, correo, cod_rest_res)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
                    `;
                    await client.query(queryReserva, [idMesaRes, horario, fechaRes, nombreRes, '8323230', 'Reservado', emailReserva, codRes]);

                    // Actualización del estado del horario
                    await state.update({ mesa: idMesaRes });
                    await flowDynamic('Tu reserva se ha realizado con éxito.');
                    await flowDynamic(`*Nombre:* ${nombreRes}\n*Comensales:* ${capacidad}\n*Email:* ${emailReserva}\n*Fecha reserva:* ${fechaRes}\n*Horario:* ${horario}\n*Mesa:* ${idMesaRes}`);
                    await enviarMailReserva(emailReserva, nombreRes, msjConfReserva);

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
                return await flowDynamic("Bares / Discotecas");
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


const welcomeFlow = addKeyword(['hi', 'hello', 'hola'])
    .addAnswer(`☀️☀️ Holaaa soy TurisBot y te doy la bienvenida a *Girardot*, donde el verano es eterno. No olvides tu traje de baño 👙 y tus ganas de disfrutar 🏊🏼. `, {}, async (ctx, { flowDynamic, gotoFlow }) => {
        return gotoFlow(menuFlow)
    })

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, menuFlow, flowCatRest, flowSitiosT, flowSelRest, flowOpcionRest, flowMenuRest, flowReservaRest, flowDespRest])

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
