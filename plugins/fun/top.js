const pluginConfig = {
    name: 'top',
    alias: ['top5', 'toplist'],
    category: 'fun',
    description: 'Random top 5 member untuk kategori tertentu',
    usage: '.top <kategori>',
    example: '.top orang pintar',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const kategori = m.args.join(' ')?.trim()
    
    if (!kategori) {
        return m.reply(
            `╭┈┈⬡「 🏆 *ᴛᴏᴘ 5* 」
┃ ㊗ ᴜsᴀɢᴇ: \`${m.prefix}top <kategori>\`
╰┈┈⬡

> \`Contoh: ${m.prefix}top orang pintar\``
        )
    }
    
    m.react('🏆')
    
    try {
        const groupMeta = m.groupMetadata
        const participants = groupMeta.participants || []
        
        const members = participants
            .map(p => p.id || p.jid)
            .filter(id => id && id !== sock.user?.id?.split(':')[0] + '@s.whatsapp.net')
        
        if (members.length < 5) {
            return m.reply(`❌ Member grup kurang dari 5 orang!`)
        }
        
        const shuffled = members.sort(() => Math.random() - 0.5)
        const top5 = shuffled.slice(0, 5)
        
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
        let list = ''
        
        top5.forEach((jid, index) => {
            list += `┃ ${medals[index]} @${jid.split('@')[0]}\n`
        })
        
        await sock.sendMessage(m.chat, {
            text: `╭┈┈⬡「 🏆 *ᴛᴏᴘ 5 ${kategori.toUpperCase()}* 」
${list}╰┈┈⬡

> _Selamat kepada yang terpilih!_ 🎉`,
            mentions: top5
        }, { quoted: m })
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${error.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
