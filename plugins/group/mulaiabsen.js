const config = require('../../config')

const pluginConfig = {
    name: 'mulaiabsen',
    alias: ['startabsen', 'bukaabsen', 'openabsen'],
    category: 'group',
    description: 'Mulai sesi absen di grup (admin only)',
    usage: '.mulaiabsen [keterangan]',
    example: '.mulaiabsen Rapat Mingguan',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true,
    isAdmin: true
}

if (!global.absensi) global.absensi = {}

async function handler(m, { sock }) {
    const chatId = m.chat
    
    if (global.absensi[chatId]) {
        return m.reply(
            `❌ *ᴍᴀsɪʜ ᴀᴅᴀ ᴀʙsᴇɴ*\n\n` +
            `> Masih ada sesi absen di grup ini!\n\n` +
            `> Ketik *.hapusabsen* untuk menghapus\n` +
            `> atau *.cekabsen* untuk melihat daftar`
        )
    }
    
    const keterangan = m.text?.trim() || 'Absen Harian'
    
    global.absensi[chatId] = {
        keterangan: keterangan,
        createdBy: m.sender,
        createdAt: new Date().toISOString(),
        peserta: []
    }
    
    const saluranId = config.saluran?.id || '120363401718869058@newsletter'
    const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
    
    await sock.sendMessage(chatId, {
        text: `📋 *ᴀʙsᴇɴ ᴅɪᴍᴜʟᴀɪ!*\n\n` +
            `╭┈┈⬡「 📋 *ɪɴғᴏ* 」\n` +
            `┃ 📝 ${keterangan}\n` +
            `┃ 👑 Dibuat oleh: @${m.sender.split('@')[0]}\n` +
            `┃ 👥 Peserta: 0\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> *.absen* - Untuk menandai kehadiran\n` +
            `> *.cekabsen* - Untuk melihat daftar\n` +
            `> *.hapusabsen* - Untuk menghapus sesi`,
        mentions: [m.sender],
        contextInfo: {
            mentionedJid: [m.sender],
            forwardingScore: 9999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: saluranId,
                newsletterName: saluranName,
                serverMessageId: 127
            }
        }
    }, { quoted: m })
}

module.exports = {
    config: pluginConfig,
    handler
}
