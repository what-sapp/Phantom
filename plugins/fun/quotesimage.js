const axios = require('axios')
const config = require('../../config')

const NEOXR_APIKEY = config.APIkey?.neoxr || 'Milik-Bot-OurinMD'

const pluginConfig = {
    name: 'quotesimage',
    alias: ['quoteimg', 'quotes-image', 'qimg'],
    category: 'fun',
    description: 'Random quotes image',
    usage: '.quotesimage',
    example: '.quotesimage',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    m.react('💬')
    
    try {
        const res = await axios.get(`https://api.neoxr.eu/api/quotesimage?apikey=${NEOXR_APIKEY}`, {
            timeout: 30000
        })
        
        if (!res.data?.status || !res.data?.data?.url) {
            m.react('❌')
            return m.reply(`❌ Gagal mengambil quotes image`)
        }
        
        const saluranId = config.saluran?.id || '120363401718869058@newsletter'
        const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
        
        await sock.sendMessage(m.chat, {
            image: { url: res.data.data.url },
            caption: `💬 *ǫᴜᴏᴛᴇs ɪᴍᴀɢᴇ*\n\n> _Ketik \`${m.prefix}quotesimage\` untuk quotes lainnya_`,
            contextInfo: {
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127
                }
            }
        }, { quoted: m })
        
        m.react('✅')
        
    } catch (err) {
        m.react('❌')
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> ${err.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
