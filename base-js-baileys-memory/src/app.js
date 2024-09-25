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

//reservabot@reservabot.iam.gserviceaccount.com

const PORT = process.env.PORT ?? 3008

const client = new Client({
    host: 'localhost', //process.env.PG_HOST,
    user: 'postgres',//process.env.PG_USER,
    password: 'postgres',//process.env.PG_PASSWORD,
    database: 'pruebados',//process.env.PG_DATABASE,
    port: '5432' //process.env.PG_PORT
});

client.connect();

const flowDespRest = addKeyword([EVENTS.ACTION])
    .addAnswer("LLAMANDO A LA CENTRAL.... 📞📞📞")

const flowMenuRest = addKeyword([EVENTS.ACTION])
    .addAnswer('Escribe el número del restaurante que deseas obtener más informacion 🤗', { capture: true }, async (ctx, { flowDynamic, gotoFlow, fallBack }) => {
        const resNumRest = ctx.body
        try {
            const query = 'SELECT ruta_menu, titulo, direccion, num_contacto FROM sitios_turisticos WHERE codigo_categoria = $1 AND homocodres = $2';
            const res = await client.query(query, ['RES', parseInt(resNumRest)]);
            if (res.rows.length > 0) {
                for (const row of res.rows) {
                    const { ruta_menu, titulo, direccion, num_contacto } = row;
                    const message = `*${titulo}*\n📲 ${num_contacto}\n📌 ${direccion}`;
                    await flowDynamic([{
                        body: message,
                        media: ruta_menu,
                    }]);
                }
                return gotoFlow(flowDespRest)
            } else {
                await flowDynamic("No hay carta disponible para el restaurante seleccionado en este momento.");
            }
        } catch (err) {
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
            const query = 'SELECT homocodres, ruta_foto, titulo, descripcion, direccion FROM sitios_turisticos WHERE codigo_categoria = $1 AND ctipres = $2';
            const res = await client.query(query, ['RES', parseInt(tipoSeleccionado)]);
            if (res.rows.length > 0) {
                for (const row of res.rows) {
                    const { homocodres, ruta_foto, titulo, descripcion, direccion } = row;
                    const message = `Restaurante #${homocodres}\n*${titulo}*\n${descripcion}\n_Dirección: ${direccion}_`;
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


const keywords = {
    "1": [
        "lugares", "sitios", "turísticos", "lugares turísticos",
        "deseo conocer girardot", "quiero conocer girardot", "quiero visitar girardot",
        "quiero ver lugares turísticos", "busco sitios para conocer", "deseo hacer turismo",
        "turismo", "quiero ver sitios", "quiero explorar", "deseo explorar girardot",
        "quiero ver qué hay en girardot", "quiero sitios turísticos", "deseo ver atracciones",
        "enseñame lugares", "enseñame girardot", "quiero turistear", "conocer", "conocer girardot",
        "deseo visitar lugares", "deseo conocer girardot"
    ],
    "2": [
        "comer", "restaurantes", "restaurante", "ver restaurantes",
        "quiero comer", "deseo comer", "busco algo de comer", "donde puedo comer",
        "quiero un restaurante", "quiero algo de comida", "deseo ir a un restaurante",
        "quiero ver restaurantes", "deseo almorzar", "deseo cenar", "busco restaurante",
        "donde puedo cenar", "busco algo para cenar", "quiero comer algo",
        "tengo hambre", "deseo almorzar algo", "muestrame restaurantes", "muero de hambre",
        "restaurantes en girardot", "restaurant", "rest", "hambre"
    ],
    "3": [
        "bares", "discotecas", "ver bares",
        "quiero tomar algo", "quiero salir de fiesta", "busco un bar", "quiero un bar",
        "deseo tomar algo", "quiero ir a un bar", "quiero ir a una discoteca",
        "donde puedo tomar algo", "quiero salir a bailar", "quiero salir a un bar",
        "deseo salir a una discoteca", "donde hay una discoteca", "busco una discoteca"
    ],
    "4": [
        "hoteles", "ver hoteles", "dormir",
        "donde puedo dormir", "quiero descansar", "deseo un hotel", "quiero un hotel",
        "busco un hotel", "quiero descansar en un hotel", "donde puedo quedarme",
        "quiero quedarme en un hotel", "deseo ir a un hotel", "busco alojamiento",
        "quiero ver alojamientos", "donde puedo quedarme a dormir"
    ],
    "5": [
        "piscinas", "ver piscinas", "nadar",
        "quiero nadar", "quiero ir a una piscina", "deseo una piscina", "donde puedo nadar",
        "quiero estar en una piscina", "busco una piscina", "quiero una piscina para nadar",
        "deseo refrescarme", "quiero planes con piscina", "quiero ver planes con piscina",
        "quiero disfrutar de una piscina"
    ],
    "6": [
        "preguntar", "pregunta", "hablar", "decir algo",
        "quiero preguntar", "tengo una duda", "quiero decir algo", "quiero saber algo",
        "quiero preguntar algo", "deseo preguntar", "necesito preguntar algo",
        "deseo saber algo", "puedo preguntar", "necesito información"
    ],
    "0": [
        "salir", "adios", "terminar",
        "deseo salir", "quiero salir", "quiero terminar", "quiero finalizar",
        "deseo terminar", "quiero cerrar", "quiero terminar la conversación",
        "ya no quiero seguir", "ya terminé", "quiero finalizar la conversación",
        "ya terminé con el bot"
    ]
};

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
