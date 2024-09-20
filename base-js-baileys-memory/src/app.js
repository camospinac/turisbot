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
                const query = 'SELECT ruta_foto, titulo, descripcion, direccion FROM sitios_turisticos WHERE codigo_categoria = $1';
                try {
                    const res = await client.query(query, ['CUL']);
                    if (res.rows.length > 0) {
                        for (const row of res.rows) {
                            const { ruta_foto, titulo, descripcion, direccion } = row;
                            const message = `*${titulo}*\n${descripcion}\n_Dirección: ${direccion}_`;
                            console.log(message);
                            await flowDynamic([{
                                body: message,
                                media: ruta_foto,
                            }]);
                        }
                    } else {
                        await flowDynamic("No hay sitios turísticos disponibles con el código 'CUL' en este momento.");
                    }
                } catch (err) {
                    console.error(err);
                    await flowDynamic("Ocurrió un error al recuperar los sitios turísticos.");
                }
                break;
            case "2":
                return await flowDynamic("Restaurantes")
            case "3":
                return await flowDynamic("Bares / Discotecas")
            case "4":
                return await flowDynamic("Hoteles")
            case "5":
                return await flowDynamic("Piscinas")
            case "6":
                return await flowDynamic("Pregunta algo")
            case "0":
                return await flowDynamic("🏃 Saliendo... Puedes volver a acceder a este menú escribiendo *Menu*");
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
            if (!ctx.body.toLocaleLowerCase().includes(['menu', 'menú'])) {
                return fallBack('Debes escribir *menu* 👀')
            }
            return
        },
        [menuFlow]
    )

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, menuFlow])

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
