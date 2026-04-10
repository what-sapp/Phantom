const pluginConfig = {
    name: ['ngl', 'nglgenerator'],
    alias: [],
    category: 'fun',
    description: 'Generate gambar NGL',
    usage: '.ngl <teks>',
    example: '.ngl beautiful girl',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.text || m.quoted?.text
    
    if (!text) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}ngl <teks>\`\n\n` +
            `> Contoh: \`${m.prefix}ngl beautiful girl\``
        )
    }
    
    await m.reply(`⏳ *Generating NGL...*`)
    
    try {
        const apiUrl = `https://api.taka.my.id/ngl?text=${encodeURIComponent(text)}`
        
        await sock.sendMessage(m.chat, {
            image: { url: apiUrl },
            caption: `💬 *NGL:* ${text}`
        }, { quoted: m })
        
        m.react('💬')
        
    } catch (err) {
        m.react('❌')
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> ${err.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
