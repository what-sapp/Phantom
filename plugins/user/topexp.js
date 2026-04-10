const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')

const pluginConfig = {
    name: 'topexp',
    alias: ['topxp', 'leaderboardexp', 'lbexp'],
    category: 'user',
    description: 'Leaderboard exp',
    usage: '.topexp',
    example: '.topexp',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
}

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']

async function handler(m, { sock }) {
    const db = getDatabase()
    
    const topUsers = db.getTopUsers('exp', 10)
    
    if (topUsers.length === 0) {
        return m.reply(`📊 *ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ ᴇxᴘ*\n\n> Belum ada data`)
    }
    
    const saluranId = config.saluran?.id || '120363401718869058@newsletter'
    const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
    
    let text = `╭━━━━━━━━━━━━━━━━━╮\n`
    text += `┃  🏆 *ᴛᴏᴘ ᴇxᴘ*\n`
    text += `╰━━━━━━━━━━━━━━━━━╯\n\n`
    
    const mentions = []
    
    for (let i = 0; i < topUsers.length; i++) {
        const user = topUsers[i]
        const medal = MEDALS[i]
        const name = user.name || user.jid
        const exp = formatNumber(user.exp || 0)
        
        text += `${medal} *${name}*\n`
        text += `    ⭐ ${exp}\n\n`
        
        mentions.push(`${user.jid}@s.whatsapp.net`)
    }
    
    text += `> 📊 Total: ${topUsers.length} users`
    
    await sock.sendMessage(m.chat, {
        text,
        mentions,
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
}

module.exports = {
    config: pluginConfig,
    handler
}
