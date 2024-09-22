import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const menuPath = path.join(__dirname, "../Notes", "welcome.txt");
const menu = fs.readFileSync(menuPath, "utf-8");
import pkg from 'pg';
const { Client } = pkg;

const PORT = process.env.PORT ?? 3008

const client = new Client({
    host: 'localhost', //process.env.PG_HOST,
    user: 'postgres',//process.env.PG_USER,
    password: 'postgres',//process.env.PG_PASSWORD,
    database: 'pruebados',//process.env.PG_DATABASE,
    port: '5432' //process.env.PG_PORT
});

client.connect();

//TODO
//CREAR EN LA TABLA sitios_turisticos DOS CAMPOS: ruta_menu Y num_contacto


const flowDespRest = addKeyword([EVENTS.ACTION])
    .addAnswer("LLAMA A LA CENTRAL INUTIL")

const flowMenuRest = addKeyword([EVENTS.ACTION])
    .addAnswer('Escribe el número del restaurante que deseas obtener más informacion 🤗', { capture: true }, async (ctx, { flowDynamic, gotoFlow, fallBack }) => {
        const resNumRest = ctx.body
        try{
            const query = 'SELECT ruta_menu, titulo, direccion, num_contacto FROM sitios_turisticos WHERE codigo_categoria = $1 AND homocodres = $2';
            const res = await client.query(query, ['RES', parseInt(resNumRest)]);
            if (res.rows.length > 0) {
                for (const row of res.rows) {
                    const { ruta_menu, titulo, direccion, num_contacto} = row;
                    const message = `*${titulo}*\n${num_contacto}\n_Dirección: ${direccion}_`;
                    await flowDynamic([{
                        body: message,
                        media: ruta_menu,
                    }]);
                }
                return gotoFlow(flowDespRest)
            } else {
                await flowDynamic("No hay carta disponible para el restaurante seleccionado en este momento.");
            }
        } catch(err){
            console.error("Error al recuperar la carta del restaurante: ", err);
            await flowDynamic("Ocurrió un error al recuperar la carta del restaurante.");
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
    .addAnswer(' _Escribe la opción que te apetece_ 😋', { capture: true }, async (ctx, { flowDynamic, gotoFlow }) => {
        const tipoSeleccionado = ctx.body;
        try {
            const query = 'SELECT codigo_sitio, ruta_foto, titulo, descripcion, direccion FROM sitios_turisticos WHERE codigo_categoria = $1 AND ctipres = $2';
            const res = await client.query(query, ['RES', parseInt(tipoSeleccionado)]);
            if (res.rows.length > 0) {
                for (const row of res.rows) {
                    const { codigo_sitio, ruta_foto, titulo, descripcion, direccion } = row;
                    const message = `${codigo_sitio}\n*${titulo}*\n${descripcion}\n_Dirección: ${direccion}_`;
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
    .addAnswer('🤔 *¿Qué deseas comer?* ', {}, async (ctx, { flowDynamic, gotoFlow }) => {
        try {
            const tipoQuery = 'SELECT id, t_descripcion FROM tipo_restaurante WHERE t_estado = $1';
            const tipoRes = await client.query(tipoQuery, ['A']);
            if (tipoRes.rows.length > 0) {
                let tiposMensaje = '';
                const opciones = [];
                for (const tipo of tipoRes.rows) {
                    tiposMensaje += `${tipo.id} - ${tipo.t_descripcion}\n`;
                    opciones.push(tipo.id.toString());  // Convertir a string
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


const menuFlow = addKeyword(['MENU', 'Menu', 'menu', 'Menú', 'menú', 'MENÚ']).addAnswer(
    menu,
    { capture: true },
    async (ctx, { gotoFlow, fallBack, flowDynamic }) => {
        if (!["1", "2", "3", "4", "5", "6", "0"].includes(ctx.body)) {
            return fallBack(
                "Respuesta no válida 😔, por favor selecciona una de las opciones ☝🏼"
            );
        }
        switch (ctx.body) {
            case "1":
                return gotoFlow(flowSitiosT);
            case "2":
                return gotoFlow(flowCatRest);
            case "3":
                return await flowDynamic("Bares / Discotecas")
            case "4":
                return await flowDynamic("Hoteles")
            case "5":
                return await flowDynamic("Piscinas")
            case "6":
                return await flowDynamic("Pregunta algo")
            case "0":
                return await flowDynamic("🏃 Saliendo... Puedes volver a acceder a este menú escribiendo *menu*");
        }
    }
);


const welcomeFlow = addKeyword(['hi', 'hello', 'hola'])
    .addAnswer(`☀️☀️ Holaaa, bienvenido a *Girardot*, donde el verano es eterno. No olvides tu traje de baño 👙 y tus ganas de disfrutar 🏊🏼. `)
    .addAnswer(
        [
            '👉 A continuación escribe *MENÚ* para mostrarte las opciones disponibles',
        ].join('\n'),
        { delay: 800, capture: true },
        async (ctx, { fallBack }) => {
            if (!['menu', 'menú'].includes(ctx.body.toLocaleLowerCase())) {
                return fallBack('Debes escribir *menu* 👀')
            }
            return
        },
        [menuFlow]
    )

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, menuFlow, flowCatRest, flowSitiosT, flowSelRest, flowOpcionRest, flowMenuRest])

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
