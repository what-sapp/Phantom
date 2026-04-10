const config = require('../../config')

const pluginConfig = {
    name: 'cekabsen',
    alias: ['listabsen', 'daftarabsen', 'lihathadir'],
    category: 'group',
    description: 'Lihat daftar peserta yang sudah absen',
    usage: '.cekabsen',
    example: '.cekabsen',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

if (!global.absensi) global.absensi = {}

async function handler(m, { sock }) {
    const chatId = m.chat
    
    if (!global.absensi[chatId]) {
        return m.reply(
            `❌ *ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴀʙsᴇɴ*\n\n` +
            `> Belum ada sesi absen di grup ini!\n\n` +
            `> Admin dapat memulai dengan\n` +
            `> *.mulaiabsen [keterangan]*`
        )
    }
    
    const absen = global.absensi[chatId]
    
    const moment = require('moment-timezone')
    const now = moment().tz('Asia/Jakarta')
    const dateStr = now.format('D MMMM YYYY')
    
    const createdDate = moment(absen.createdAt).tz('Asia/Jakarta')
    const timeStr = createdDate.format('HH:mm')
    
    let list = '┃ _Belum ada yang absen_'
    if (absen.peserta.length > 0) {
        list = absen.peserta
            .map((jid, i) => `┃ ${i + 1}. @${jid.split('@')[0]}`)
            .join('\n')
    }
    
    const saluranId = config.saluran?.id || '120363401718869058@newsletter'
    const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
    
    await sock.sendMessage(chatId, {
        text: `📋 *ᴅᴀғᴛᴀʀ ᴀʙsᴇɴ*\n\n` +
            `╭┈┈⬡「 📋 *ɪɴғᴏ* 」\n` +
            `┃ 📝 ${absen.keterangan}\n` +
            `┃ 📅 ${dateStr}\n` +
            `┃ ⏰ Dimulai: ${timeStr}\n` +
            `┃ 👑 Dibuat: @${absen.createdBy.split('@')[0]}\n` +
            `├┈┈⬡「 👥 *ᴘᴇsᴇʀᴛᴀ (${absen.peserta.length})* 」\n` +
            `${list}\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> _Ketik *.absen* untuk hadir_`,
        mentions: [...absen.peserta, absen.createdBy],
        contextInfo: {
            mentionedJid: [...absen.peserta, absen.createdBy],
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
