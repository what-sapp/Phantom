const axios = require('axios')
const config = require('../../config')

const NEOXR_APIKEY = config.APIkey?.neoxr || 'Milik-Bot-OurinMD'

const pluginConfig = {
    name: 'fuckmylife',
    alias: ['fml'],
    category: 'fun',
    description: 'Random FML story',
    usage: '.fuckmylife',
    example: '.fuckmylife',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    m.react('😂')
    
    try {
        const res = await axios.get(`https://api.neoxr.eu/api/fml?apikey=${NEOXR_APIKEY}`, {
            timeout: 30000
        })
        
        if (!res.data?.status || !res.data?.data?.text) {
            m.react('❌')
            return m.reply(`❌ Gagal mengambil FML story`)
        }
        
        const text = `😭 *ꜰ*ᴄᴋ ᴍʏ ʟɪꜰᴇ*\n\n` +
            `> ${res.data.data.text}\n\n` +
            `_Ketik \`${m.prefix}fml\` untuk cerita lainnya_`
        
        await m.reply(text)
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
