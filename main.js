const { 
    makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    makeInMemoryStore, 
    makeCacheableSignalKeyStore, 
    Browsers
} = require('@whiskeysockets/baileys'); 
 
const pino = require('pino'); 
const readline = require('readline'); 
const NodeCache = require('node-cache'); 
const { Boom } = require('@hapi/boom'); 
const chalk = require('chalk'); 

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) }); 
const msgRetryCounterCache = new NodeCache(); 

async function handleConnectionUpdate(conn, update) { 
    const { connection, lastDisconnect } = update; 
    try { 
        if (connection === 'close') { 
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode; 
            switch (reason) { 
                case DisconnectReason.badSession: 
                    console.log(chalk.red(`Bad Session File, Please Delete Session and Scan Again`)); 
                    connectToWhatsApp(); 
                    break; 
                case DisconnectReason.connectionClosed: 
                    console.log(chalk.yellow("Connection closed, reconnecting....")); 
                    connectToWhatsApp(); 
                    break; 
                case DisconnectReason.connectionLost: 
                    console.log(chalk.yellow("Connection Lost from Server, reconnecting...")); 
                    connectToWhatsApp(); 
                    break; 
                case DisconnectReason.connectionReplaced: 
                    console.log(chalk.yellow("Connection Replaced, Another New Session Opened, Please Close Current Session First")); 
                    connectToWhatsApp(); 
                    break; 
                case DisconnectReason.loggedOut: 
                    console.log(chalk.red(`Device Logged Out, Please Delete Session and Scan Again.`)); 
                    connectToWhatsApp(); 
                    break; 
                case DisconnectReason.restartRequired: 
                    console.log(chalk.yellow("Restart Required, Restarting...")); 
                    connectToWhatsApp(); 
                    break; 
                case DisconnectReason.timedOut: 
                    console.log(chalk.yellow("Connection TimedOut, Reconnecting...")); 
                    connectToWhatsApp(); 
                    break; 
                default: 
                    conn.end(chalk.red(`Unknown DisconnectReason: ${reason}|${connection}`)); 
            } 
        } else if (update.connection === "connecting" || update.receivedPendingNotifications === "false") { 
            console.log(chalk.yellow(`Connecting...`)); 
        } else if (update.connection === "open" || update.receivedPendingNotifications === "true") { 
            console.log(chalk.green(`Connected to: ${JSON.stringify(conn.user, null, 2)}`)); 
        } 
    } catch (err) { 
        console.log(chalk.red('Error in Connection.update ' + err)); 
        connectToWhatsApp(); 
    } 
} 
 
async function connectToWhatsApp() { 
    let { version, isLatest } = await fetchLatestBaileysVersion(); 
    const { state, saveCreds } = await useMultiFileAuthState('./session'); 
    const conn = makeWASocket({ 
        logger: pino({ level: 'silent' }), 
        printQRInTerminal: true, 
        browser: Browsers.windows('Edge'), 
        patchMessageBeforeSending: (message) => { 
            const requiresPatch = !!( 
                message.buttonsMessage || 
                message.templateMessage || 
                message.listMessage 
            ); 
            if (requiresPatch) { 
                message = { 
                    viewOnceMessage: { 
                        message: { 
                            messageContextInfo: { 
                                deviceListMetadataVersion: 2, 
                                deviceListMetadata: {}, 
                            }, 
                            ...message, 
                        }, 
                    }, 
                }; 
            } 
            return message; 
        }, 
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })), 
        }, 
        markOnlineOnConnect: true, 
        generateHighQualityLinkPreview: true, 
        getMessage: async (key) => { 
            if (store) { 
                const msg = await store.loadMessage(key.remoteJid, key.id); 
                return msg.message || undefined; 
            } 
            return { conversation: "Bot is online" }; 
        }, 
        msgRetryCounterCache, 
        defaultQueryTimeoutMs: undefined, 
    }); 
 
    store.bind(conn.ev);

    conn.ev.on('connection.update', (update) => handleConnectionUpdate(conn, update)); 
    conn.ev.on('creds.update', saveCreds);
    conn.ev.on('messages.upsert', async chatUpdate => { 
        let m = chatUpdate.messages[0];
        let jid = m.key.remoteJid;
        if (m.key.fromMe) return;

        const messageText = m.message?.conversation || "No conversation text"; 

        if (/adji|aji|muklis|muklit/i.test(messageText)) {
            await conn.sendMessage(jid, {
                react: {
                    text: "🫡",
                    key: m.key
                }
            }, {
                quoted: m
            });
        }
        
        await conn.readMessages([m.key]); 
        if (m.key && m.key.remoteJid === 'status@broadcast') { 
            await conn.readMessages([m.key]); 
        }

        console.log(chalk.greenBright(`\nMessage from: ${m.pushName}\nText: ${messageText}\nJid: ${m.key.remoteJid}`)); 
    });
} 
 
connectToWhatsApp();
