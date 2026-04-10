const QRCode = require('qrcode')
const path = require('path')
const fs = require('fs')
const { delay, DisconnectReason, jidNormalizedUser, useMultiFileAuthState } = require('ourin')
const { logger } = require('./colors')

const JADIBOT_AUTH_FOLDER = path.join(process.cwd(), 'session', 'jadibot')
const jadibotSessions = new Map()
const reconnectAttempts = new Map()
const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_INTERVAL = 5000

if (!fs.existsSync(JADIBOT_AUTH_FOLDER)) {
    fs.mkdirSync(JADIBOT_AUTH_FOLDER, { recursive: true })
}

function getJadibotAuthPath(jid) {
    const id = jid.replace(/@.+/g, '')
    return path.join(JADIBOT_AUTH_FOLDER, id)
}

function isJadibotActive(jid) {
    const id = jid.replace(/@.+/g, '')
    return jadibotSessions.has(id)
}

function getActiveJadibots() {
    return Array.from(jadibotSessions.entries()).map(([id, data]) => ({
        id,
        jid: id + '@s.whatsapp.net',
        ...data
    }))
}

function getAllJadibotSessions() {
    const sessions = []
    if (!fs.existsSync(JADIBOT_AUTH_FOLDER)) return sessions

    const dirs = fs.readdirSync(JADIBOT_AUTH_FOLDER)
    for (const dir of dirs) {
        const credsPath = path.join(JADIBOT_AUTH_FOLDER, dir, 'creds.json')
        if (fs.existsSync(credsPath)) {
            sessions.push({
                id: dir,
                jid: dir + '@s.whatsapp.net',
                isActive: jadibotSessions.has(dir),
                credsPath
            })
        }
    }
    return sessions
}

const rateLimit = new Map()

const ERROR_MESSAGES = {
    401: { reason: 'Number not registered on WhatsApp', action: 'Make sure this number is active on WhatsApp', fatal: true },
    403: { reason: 'Access denied/banned', action: 'This number may be banned by WhatsApp', fatal: true },
    405: { reason: 'Method not allowed', action: 'Try again later', fatal: true },
    406: { reason: 'Number restricted', action: 'This number is restricted by WhatsApp, wait a few hours', fatal: true },
    408: { reason: 'Request timeout', action: 'Slow connection, will attempt reconnect', fatal: false },
    409: { reason: 'Session conflict', action: 'Session is being used on another device', fatal: true },
    411: { reason: 'Authentication failed', action: 'Need to rescan QR/pairing', fatal: true },
    428: { reason: 'Rate limit', action: 'Too many requests, wait a few minutes', fatal: true },
    440: { reason: 'Login required', action: 'Session expired, need to login again', fatal: true },
    500: { reason: 'WhatsApp server error', action: 'WhatsApp server is having issues', fatal: false },
    501: { reason: 'Not implemented', action: 'Feature not yet supported', fatal: true },
    503: { reason: 'Service unavailable', action: 'WhatsApp is under maintenance', fatal: false },
    515: { reason: 'Stream error', action: 'Will attempt reconnect', fatal: false }
}

const CONNECTION_CLOSED_REASONS = [
    { match: /Connection Closed/i, reason: 'Connection closed', action: 'Number may be banned or network issue', fatal: true },
    { match: /write EOF/i, reason: 'Connection lost', action: 'Network issue, will attempt reconnect', fatal: false },
    { match: /ECONNRESET/i, reason: 'Connection reset', action: 'Unstable network', fatal: false },
    { match: /ETIMEDOUT/i, reason: 'Timeout', action: 'Slow connection', fatal: false },
    { match: /logged out/i, reason: 'Logged out', action: 'Account logged out from device', fatal: true },
    { match: /replaced/i, reason: 'Session replaced', action: 'Logged in on another device', fatal: true },
    { match: /Multidevice mismatch/i, reason: 'Invalid session', action: 'Need to rescan', fatal: true },
    { match: /restart required/i, reason: 'Restart required', action: 'Will restart automatically', fatal: false },
    { match: /bad session/i, reason: 'Corrupted session', action: 'Need to rescan', fatal: true }
]

function parseDisconnectError(lastDisconnect) {
    const statusCode = lastDisconnect?.error?.output?.statusCode
    const errorMessage = lastDisconnect?.error?.message || 'Unknown error'

    if (statusCode && ERROR_MESSAGES[statusCode]) {
        return {
            ...ERROR_MESSAGES[statusCode],
            code: statusCode,
            message: errorMessage
        }
    }

    for (const pattern of CONNECTION_CLOSED_REASONS) {
        if (pattern.match.test(errorMessage)) {
            return {
                code: statusCode || 'N/A',
                reason: pattern.reason,
                action: pattern.action,
                fatal: pattern.fatal,
                message: errorMessage
            }
        }
    }

    return {
        code: statusCode || 'N/A',
        reason: 'Unknown error',
        action: 'Contact admin if persists',
        fatal: false,
        message: errorMessage
    }
}

function isSocketAlive(sock) {
    try {
        return sock && sock.ws && sock.ws.readyState === 1
    } catch {
        return false
    }
}

async function safeSend(sock, jid, content, options = {}) {
    try {
        if (!isSocketAlive(sock)) return null
        return await sock.sendMessage(jid, content, options)
    } catch {
        return null
    }
}

async function startJadibot(sock, m, userJid, usePairing = true) {
    if (!userJid || typeof userJid !== 'string' || !userJid.includes('@s.whatsapp.net')) {
        throw new Error('Invalid User JID')
    }

    const id = userJid.replace(/@.+/g, '')

    if (usePairing) {
        const lastAttempt = rateLimit.get(id) || 0
        if (Date.now() - lastAttempt < 60000) {
            throw new Error('Wait 1 minute before trying again.')
        }
        rateLimit.set(id, Date.now())
    }

    const authPath = getJadibotAuthPath(userJid)

    if (jadibotSessions.has(id)) {
        throw new Error('Jadibot is already active for this number!')
    }

    if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath)

    const { default: makeWASocket, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('ourin')
    const { version } = await fetchLatestBaileysVersion()
    const pinoLogger = require('pino')({ level: 'silent' })

    const childSock = makeWASocket({
        version,
        logger: pinoLogger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pinoLogger)
        },
        browser: ['Ubuntu', 'Chrome', '20.0.0'],
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: true,
        defaultQueryTimeoutMs: 20000,
        connectTimeoutMs: 20000,
        keepAliveIntervalMs: 10000,
        retryRequestDelayMs: 150,
        fireInitQueries: true,
        emitOwnEvents: true,
        shouldSyncHistoryMessage: () => false,
        transactionOpts: { maxCommitRetries: 5, delayBetweenTriesMs: 500 }
    })

    let qrCount = 0
    let lastQRMsg = null
    let pairingCode = null
    let heartbeatInterval = null

    if (usePairing && !state.creds?.registered) {
        try {
            await delay(3000)
            pairingCode = await childSock.requestPairingCode(id)
            pairingCode = pairingCode.match(/.{1,4}/g)?.join('-') || pairingCode

            if (m && m.chat) {
                let thumbnail = null
                try {
                    if (fs.existsSync('./assets/images/ourin2.jpg')) {
                        thumbnail = fs.readFileSync('./assets/images/ourin2.jpg')
                    }
                } catch {}

                await sock.sendMessage(m.chat, {
                    text: `🔗 *ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ*\n\n` +
                        `Enter the following code in your WhatsApp:\n\n` +
                        `> 📱 *Settings → Linked Devices → Link a Device*\n\n` +
                        `\`\`\`${pairingCode}\`\`\`\n\n` +
                        `> ⏳ Code valid for a few minutes\n` +
                        `> ⚠️ Do not share this code with anyone`,
                    contextInfo: {
                        externalAdReply: {
                            title: '🤖 Jadibot — Pairing Code',
                            body: 'Tap button below to copy code',
                            ...(thumbnail ? { thumbnail } : {}),
                            sourceUrl: null,
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    },
                    interactiveButtons: [
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📋 Copy Pairing Code',
                                copy_code: pairingCode.replace(/-/g, '')
                            })
                        }
                    ]
                }, { quoted: m })
            } else {
                logger.info('Jadibot', `Pairing Code for ${id}: ${pairingCode}`)
            }
        } catch (e) {
            logger.error('Jadibot', 'Failed to get pairing code: ' + e.message)

            let errorMsg = 'Failed to get pairing code'
            if (e.message?.includes('rate') || e.message?.includes('limit') || e.message?.includes('428')) {
                errorMsg = 'Rate limited! Wait 5-10 minutes.'
            } else if (e.message?.includes('banned') || e.message?.includes('blocked')) {
                errorMsg = 'Number may be banned by WhatsApp.'
            } else if (e.message?.includes('Connection Closed') || e.message?.includes('closed')) {
                errorMsg = 'Connection lost. Try again.'
            }

            await safeSend(sock, m.chat, {
                text: `❌ *ᴊᴀᴅɪʙᴏᴛ ғᴀɪʟᴇᴅ*\n\n> ${errorMsg}`
            }, { quoted: m })

            try { childSock.end?.() } catch {}
            jadibotSessions.delete(id)
            reconnectAttempts.delete(id)
            throw new Error(errorMsg)
        }
    }

    childSock.ev.on('creds.update', saveCreds)

    childSock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr && !usePairing) {
            qrCount++
            if (qrCount > 3) {
                await safeSend(sock, m.chat, { text: '❌ QR Code expired! Please try again.' })
                if (lastQRMsg?.key) {
                    await safeSend(sock, m.chat, { delete: lastQRMsg.key })
                }
                jadibotSessions.delete(id)
                reconnectAttempts.delete(id)
                try { childSock.ws.close() } catch {}
                return
            }

            try {
                const qrBuffer = await QRCode.toBuffer(qr, {
                    scale: 8,
                    margin: 4,
                    width: 256,
                    color: { dark: '#000000ff', light: '#ffffffff' }
                })

                if (lastQRMsg?.key) {
                    await safeSend(sock, m.chat, { delete: lastQRMsg.key })
                }

                lastQRMsg = await sock.sendMessage(m.chat, {
                    image: qrBuffer,
                    caption: `🤖 *ᴊᴀᴅɪʙᴏᴛ — Qʀ ᴄᴏᴅᴇ*\n\n` +
                        `Scan this QR code to become a bot.\n\n` +
                        `> ⏱️ Expires in 20 seconds\n` +
                        `> 📊 QR Count: ${qrCount}/3`
                }, { quoted: m })
            } catch (e) {
                logger.error('Jadibot', 'Failed to send QR: ' + e.message)
            }
        }

        if (connection === 'open') {
            logger.info('Jadibot', `Connected: ${id}`)

            reconnectAttempts.delete(id)

            jadibotSessions.set(id, {
                sock: childSock,
                jid: childSock.user?.jid || userJid,
                startedAt: Date.now(),
                ownerJid: m.sender,
                status: 'connected',
                connectionReady: false,
                pendingMessages: []
            })

            heartbeatInterval = setInterval(() => {
                try {
                    if (!isSocketAlive(childSock)) {
                        clearInterval(heartbeatInterval)
                    }
                } catch {}
            }, 30000)

            const session = jadibotSessions.get(id)
            if (session) {
                session.heartbeatInterval = heartbeatInterval
            }

            try {
                await childSock.sendPresenceUpdate('available')
            } catch {}

            await safeSend(sock, m.chat, {
                text: `✅ *ᴊᴀᴅɪʙᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇᴅ*\n\n` +
                    `> 📱 Number: *@${id}*\n` +
                    `> 🟢 Status: *Online*\n` +
                    `> ⏱️ Started: *${new Date().toLocaleTimeString('id-ID')}*\n\n` +
                    `Your bot is active and ready to receive commands!\n\n` +
                    `> ℹ️ Type \`${m.prefix || '.'}stopjadibot\` to stop`,
                mentions: [userJid],
                contextInfo: {
                    mentionedJid: [userJid],
                    externalAdReply: {
                        title: '✅ Jadibot Connected',
                        body: `@${id} successfully connected`,
                        sourceUrl: null,
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            }, { quoted: m })

            if (lastQRMsg?.key) {
                await safeSend(sock, m.chat, { delete: lastQRMsg.key })
            }

            setTimeout(async () => {
                const sess = jadibotSessions.get(id)
                if (sess) {
                    sess.connectionReady = true
                    const pending = sess.pendingMessages || []
                    sess.pendingMessages = []
                    if (pending.length > 0) {
                        logger.info('Jadibot', `Flushing ${pending.length} buffered messages for ${id}`)
                        const { messageHandler } = require('../handler')
                        for (const bufferedMsg of pending) {
                            try {
                                await messageHandler(bufferedMsg, childSock, { isJadibot: true, jadibotId: id })
                            } catch {}
                        }
                    }
                }
            }, 2000)
        }

        if (connection === 'close') {
            const errorInfo = parseDisconnectError(lastDisconnect)

            logger.info('Jadibot', `Disconnected: ${id}, code: ${errorInfo.code}, reason: ${errorInfo.reason}`)

            const session = jadibotSessions.get(id)
            if (session?.heartbeatInterval) {
                clearInterval(session.heartbeatInterval)
            }

            const attempts = reconnectAttempts.get(id) || 0

            if (errorInfo.fatal || attempts >= MAX_RECONNECT_ATTEMPTS) {
                jadibotSessions.delete(id)
                reconnectAttempts.delete(id)

                if (errorInfo.fatal) {
                    try {
                        if (fs.existsSync(authPath)) {
                            fs.rmSync(authPath, { recursive: true, force: true })
                        }
                    } catch {}
                }

                let statusEmoji = '❌'
                if (errorInfo.code === 403 || errorInfo.reason?.includes('banned')) {
                    statusEmoji = '🚫'
                } else if (errorInfo.code === 406 || errorInfo.reason?.includes('restricted')) {
                    statusEmoji = '⚠️'
                }

                await safeSend(sock, m.chat, {
                    text: `${statusEmoji} *ᴊᴀᴅɪʙᴏᴛ ᴅɪsᴄᴏɴɴᴇᴄᴛᴇᴅ*\n\n` +
                        `> 📱 Number: *@${id}*\n` +
                        `> 🔢 Code: \`${errorInfo.code}\`\n` +
                        `> 📋 Reason: *${errorInfo.reason}*\n` +
                        `> ℹ️ ${errorInfo.action}\n\n` +
                        (errorInfo.fatal ? `> ⚠️ Session deleted. Use \`.jadibot\` to restart.` : ''),
                    mentions: [userJid]
                })
            } else {
                reconnectAttempts.set(id, attempts + 1)

                await safeSend(sock, m.chat, {
                    text: `🔄 *ᴊᴀᴅɪʙᴏᴛ ʀᴇᴄᴏɴɴᴇᴄᴛɪɴɢ...*\n\n` +
                        `> 📱 Number: *@${id}*\n` +
                        `> 📋 Reason: *${errorInfo.reason}*\n` +
                        `> 🔁 Attempt: *${attempts + 1}/${MAX_RECONNECT_ATTEMPTS}*\n\n` +
                        `> Reconnecting in ${RECONNECT_INTERVAL / 1000} seconds...`,
                    mentions: [userJid]
                })

                setTimeout(() => {
                    startJadibot(sock, m, userJid, false).catch((e) => {
                        logger.error('Jadibot', `Reconnect failed for ${id}: ${e.message}`)
                        jadibotSessions.delete(id)
                        reconnectAttempts.delete(id)
                    })
                }, RECONNECT_INTERVAL)
            }
        }
    })

    const processedMessages = new Map()

    childSock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (!childSock.user || !childSock.user.id) {
            childSock.user = {
                id: jidNormalizedUser(id),
                name: 'Jadibot'
            }
        }

        if (type !== 'notify') return

        for (const msg of messages) {
            if (!msg.message) continue

            const msgId = msg.key?.id
            if (msgId && processedMessages.has(msgId)) continue
            if (msgId) processedMessages.set(msgId, Date.now())

            if (msg.key && msg.key.remoteJid === 'status@broadcast') continue

            const msgTimestamp = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now()
            const msgAge = Date.now() - msgTimestamp
            if (msgAge > 60 * 60 * 1000) continue

            const msgType = Object.keys(msg.message)[0]
            const ignoredTypes = [
                "protocolMessage", "senderKeyDistributionMessage", "reactionMessage",
                "stickerSyncRmrMessage", "encReactionMessage", "pollUpdateMessage",
                "keepInChatMessage"
            ]
            if (ignoredTypes.includes(msgType)) continue

            if (!isSocketAlive(childSock)) continue

            const session = jadibotSessions.get(id)
            if (session && !session.connectionReady) {
                session.pendingMessages = session.pendingMessages || []
                session.pendingMessages.push(msg)
                continue
            }

            try {
                const { messageHandler } = require('../handler')
                await messageHandler(msg, childSock, { isJadibot: true, jadibotId: id })
            } catch (e) {
                if (e.message?.includes('Connection Closed') || e.message?.includes('428')) {
                    logger.info('Jadibot', `${id} connection closed during handler, skipping`)
                    break
                }
                logger.error('Jadibot', `Handler error for ${id}: ${e.message}`)
            }
        }

        const fiveMinAgo = Date.now() - 300000
        for (const [key, time] of processedMessages) {
            if (time < fiveMinAgo) processedMessages.delete(key)
        }
    })

    return { sock: childSock, pairingCode }
}

async function stopJadibot(jid, deleteSession = false) {
    const id = jid.replace(/@.+/g, '')
    const session = jadibotSessions.get(id)

    if (session) {
        try {
            if (session.heartbeatInterval) {
                clearInterval(session.heartbeatInterval)
            }
            session.sock.ev.removeAllListeners()
            session.sock.ws.close()
        } catch {}
        jadibotSessions.delete(id)
    }

    reconnectAttempts.delete(id)

    if (deleteSession) {
        const authPath = getJadibotAuthPath(jid)
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true })
        }
    }

    return true
}

async function stopAllJadibots() {
    const stopped = []
    for (const [id, session] of jadibotSessions) {
        try {
            if (session.heartbeatInterval) {
                clearInterval(session.heartbeatInterval)
            }
            session.sock.ev.removeAllListeners()
            session.sock.ws.close()
        } catch {}
        stopped.push(id)
    }
    jadibotSessions.clear()
    reconnectAttempts.clear()
    return stopped
}

async function restartJadibotSession(sock, sessionId) {
    const userJid = sessionId + '@s.whatsapp.net'
    try {
        logger.info('Jadibot', `Restoring session: ${sessionId}`)
        const mockM = {
            chat: userJid,
            sender: userJid,
            prefix: '.',
            key: {
                remoteJid: userJid,
                fromMe: false,
                id: 'restart-' + Date.now()
            }
        }
        await startJadibot(sock, mockM, userJid, false)
    } catch (e) {
        logger.error('Jadibot', `Failed to restore ${sessionId}: ${e.message}`)
    }
}

function getJadibotStatus(jid) {
    const id = jid.replace(/@.+/g, '')
    const session = jadibotSessions.get(id)
    if (!session) return null

    return {
        id,
        jid: session.jid,
        status: session.status || 'unknown',
        startedAt: session.startedAt,
        ownerJid: session.ownerJid,
        uptime: Date.now() - session.startedAt
    }
}

module.exports = {
    JADIBOT_AUTH_FOLDER,
    jadibotSessions,
    getJadibotAuthPath,
    isJadibotActive,
    getActiveJadibots,
    getAllJadibotSessions,
    startJadibot,
    stopJadibot,
    stopAllJadibots,
    restartJadibotSession,
    getJadibotStatus,
    isSocketAlive,
    safeSend
}