const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')

const pluginConfig = {
    name: 'topkoin',
    alias: ['topcoin', 'leaderboardkoin', 'lbkoin'],
    category: 'user',
    description: 'Leaderboard koin',
    usage: '.topkoin',
    example: '.topkoin',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

function formatKoin(num) {
    if (num >= 1000000000000) return (num / 1000000000000).toFixed(2) + 'T'
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B'
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K'
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']

async function handler(m, { sock }) {
    const db = getDatabase()
    
    // Get top users sorted by koin
    const topUsers = db.getTopUsers('koin', 10)
    
    if (topUsers.length === 0) {
        return m.reply('❌ Belum ada data user.')
    }
    
    let text = `╭━━━━━━━━━━━━━━━━━╮\n`
    text += `┃  🏆 *ᴛᴏᴘ ᴋᴏɪɴ*\n`
    text += `╰━━━━━━━━━━━━━━━━━╯\n\n`
    
    text += `╭┈┈⬡「 📋 *ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ* 」\n`
    
    // Find sender rank
    const senderRank = topUsers.findIndex(u => u.jid === m.sender.replace(/@.+/g, '')) + 1
    
    topUsers.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`
        const name = user.name || 'Unknown'
        const koin = formatKoin(user.koin || 0)
        const isSender = m.sender.includes(user.jid) ? ' (You)' : ''
        
        text += `┃ ${medal} ${name}${isSender}\n`
        text += `    💰 ${koin}\n\n`
    })
    
    text += `╰┈┈┈┈┈┈┈┈⬡\n\n`
    
    if (senderRank > 0) {
        text += `> Kamu berada di posisi #${senderRank}`
    } else {
        const user = db.getUser(m.sender)
        const koin = formatKoin(user?.koin || 0)
        text += `> Kamu tidak masuk top 10\n`
        text += `> Koin kamu: ${koin}`
    }
    
    await m.reply(text)
}

module.exports = {
    config: pluginConfig,
    handler
}
