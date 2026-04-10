const { getSession, createSession, endSession, setSessionTimer } = require('../../src/lib/gameData')

const pluginConfig = {
    name: 'sulap',
    alias: ['magic', 'magictrick'],
    category: 'fun',
    description: 'Pertunjukan sulap - kick member secara dramatis',
    usage: '.sulap',
    example: '.sulap (lalu reply/mention target)',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 60,
    energi: 0,
    isEnabled: true,
    isAdmin: true,
    isBotAdmin: true
}

if (!global.sulapSessions) {
    global.sulapSessions = new Map()
}

const phases = [
    "🎩✨ *ᴘᴇʀᴛᴜɴᴊᴜᴋᴀɴ sᴜʟᴀᴘ ᴅɪᴍᴜʟᴀɪ!*",
    "🪄 Selamat datang di pertunjukan sulap!",
    "🎪 Bersiaplah untuk menyaksikan keajaiban...",
    "✨ Apakah kalian siap?",
    "⏳ Hitung mundur dimulai...",
    "3️⃣ *TIGA...*",
    "2️⃣ *DUA...*",
    "1️⃣ *SATU...*",
    "🪄 *ABRAKADABRA!*\n\n> Reply/mention target yang akan menghilang!"
]

const successLines = [
    "💨 *POOF!* Dan... dia menghilang!",
    "🎭 Wahh... kurang beruntung!",
    "🌟 Sulap berhasil! Sampai jumpa lagi~",
    "✨ Absen dulu ya, ditunggu berikutnya!",
    "🎪 Pertunjukan selesai! 👏"
]

const failLines = [
    "😅 Ups... sulapnya gagal",
    "🎭 Target kebal terhadap sihir!",
    "💫 Sihirnya meleset...",
]

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function handler(m, { sock }) {
    const groupId = m.chat

    if (global.sulapSessions.has(groupId)) {
        return m.reply(`🎩 *sᴜʟᴀᴘ ᴀᴋᴛɪꜰ*\n\n> Pertunjukan sedang berlangsung!\n> Reply pesan target atau mention @target`)
    }

    m.react('🎩')

    const sent = await sock.sendMessage(groupId, { text: phases[0] })
    const key = sent.key

    global.sulapSessions.set(groupId, {
        admin: m.sender,
        startTime: Date.now()
    })

    const delays = [1000, 1000, 1000, 1500, 800, 800, 800, 1000]

    for (let i = 1; i < phases.length; i++) {
        await sleep(delays[i - 1])
        await sock.sendMessage(groupId, { text: phases[i], edit: key })
    }

    setTimeout(() => {
        if (global.sulapSessions.has(groupId)) {
            const session = global.sulapSessions.get(groupId)
            if (session.startTime === global.sulapSessions.get(groupId)?.startTime) {
                global.sulapSessions.delete(groupId)
                sock.sendMessage(groupId, {
                    text: `⏰ *ᴡᴀᴋᴛᴜ ʜᴀʙɪs*\n\n> Pertunjukan sulap dibatalkan\n> Pesulap kehabisan mana ✨`,
                    edit: key
                })
            }
        }
    }, 60000)
}

async function answerHandler(m, sock) {
    if (!m.isGroup) return false

    const groupId = m.chat
    const session = global.sulapSessions.get(groupId)

    if (!session) return false
    if (m.sender !== session.admin) return false

    let targetJid = null

    if (m.quoted) {
        targetJid = m.quoted.sender
    } else if (m.mentionedJid?.length > 0) {
        targetJid = m.mentionedJid[0]
    }

    if (!targetJid) return false

    global.sulapSessions.delete(groupId)

    const targetNumber = targetJid.split('@')[0]
    const botNumber = sock.user?.id?.split(':')[0]
    const senderNumber = m.sender.split('@')[0]

    if (targetNumber === botNumber) {
        await sock.sendMessage(groupId, { text: `🎭 *ᴇʜʜʜ*\n\n> Pesulap tidak bisa menghilangkan dirinya sendiri! 😅` })
        return true
    }

    if (targetJid === m.sender) {
        await sock.sendMessage(groupId, { text: `🎭 *ᴡᴀʜʜʜ*\n\n> Kamu mau bunuh diri? 😂\n> Coba lagi dengan target lain!` })
        return true
    }

    try {
        const groupMeta = await sock.groupMetadata(groupId)
        const targetParticipant = groupMeta.participants.find(p =>
            p.id === targetJid || p.jid === targetJid || p.id?.includes(targetNumber)
        )

        if (!targetParticipant) {
            await sock.sendMessage(groupId, { text: `🔮 *ᴛᴀʀɢᴇᴛ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n> Orang tersebut tidak ada di grup! 👻` })
            return true
        }

        if (['admin', 'superadmin'].includes(targetParticipant.admin)) {
            await sock.sendMessage(groupId, { text: `🛡️ *ᴛᴀʀɢᴇᴛ ᴋᴇʙᴀʟ*\n\n> Admin grup kebal terhadap sihir! ✨` })
            return true
        }

        const statusMsg = await sock.sendMessage(groupId, { text: `🪄 *BERSIAPLAH @${targetNumber}*`, mentions: [targetJid] })
        await sleep(1000)

        await sock.groupParticipantsUpdate(groupId, [targetJid], 'remove')
        await sleep(500)

        const randomSuccess = successLines[Math.floor(Math.random() * successLines.length)]
        await sock.sendMessage(groupId, {
            text: `${randomSuccess}\n\n` +
                `╭┈┈⬡「 🎩 *ʜᴀsɪʟ sᴜʟᴀᴘ* 」\n` +
                `┃ 🎯 ᴛᴀʀɢᴇᴛ: @${targetNumber}\n` +
                `┃ 🎩 ᴘᴇsᴜʟᴀᴘ: @${senderNumber}\n` +
                `┃ ✨ sᴛᴀᴛᴜs: Menghilang!\n` +
                `╰┈┈⬡\n\n` +
                `> _Sampai jumpa di pertunjukan berikutnya!_ ✨`,
            mentions: [targetJid, m.sender],
            edit: statusMsg.key
        })

    } catch (error) {
        const randomFail = failLines[Math.floor(Math.random() * failLines.length)]
        await sock.sendMessage(groupId, { text: `${randomFail}\n\n> Error: ${error.message}` })
    }

    return true
}

function hasSulapSession(chatId) {
    return global.sulapSessions.has(chatId)
}

function getSulapSession(chatId) {
    return global.sulapSessions.get(chatId)
}

module.exports = {
    config: pluginConfig,
    handler,
    answerHandler,
    hasSulapSession,
    getSulapSession
}
