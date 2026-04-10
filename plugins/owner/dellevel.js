const { getDatabase } = require('../../src/lib/database')
const { calculateLevel, getRole } = require('../user/level')

const pluginConfig = {
    name: 'dellevel',
    alias: ['kuranglevel', 'removelevel', 'dellvl'],
    category: 'owner',
    description: 'Kurangi level user (via exp)',
    usage: '.dellevel <jumlah> @user',
    example: '.dellevel 5 @user',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

function extractTarget(m) {
    if (m.quoted) return m.quoted.sender
    if (m.mentionedJid?.length) return m.mentionedJid[0]
    return null
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const args = m.args
    
    const numArg = args.find(a => !isNaN(a) && !a.startsWith('@'))
    let levels = parseInt(numArg) || 0
    
    let targetJid = extractTarget(m)
    
    if (!targetJid && levels > 0) {
        targetJid = m.sender
    }
    
    if (!targetJid || levels <= 0) {
        return m.reply(
            `📊 *ᴅᴇʟ ʟᴇᴠᴇʟ*\n\n` +
            `╭┈┈⬡「 📋 *ᴜsᴀɢᴇ* 」\n` +
            `┃ > \`.dellevel <jumlah>\` - ke diri sendiri\n` +
            `┃ > \`.dellevel <jumlah> @user\` - ke orang lain\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Contoh: \`${m.prefix}dellevel 5\``
        )
    }
    
    const user = db.getUser(targetJid) || db.setUser(targetJid)
    if (!user.rpg) user.rpg = {}
    
    const oldLevel = calculateLevel(user.rpg.exp || 0)
    const expToRemove = levels * 20000
    user.rpg.exp = Math.max(0, (user.rpg.exp || 0) - expToRemove)
    const newLevel = calculateLevel(user.rpg.exp)
    
    db.save()
    m.react('✅')
    
    await m.reply(
        `✅ *ʟᴇᴠᴇʟ ᴅɪᴋᴜʀᴀɴɢɪ*\n\n` +
        `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
        `┃ 👤 User: @${targetJid.split('@')[0]}\n` +
        `┃ ➖ Kurang: *-${levels} Level*\n` +
        `┃ 🚄 Exp Removed: *-${expToRemove.toLocaleString('id-ID')}*\n` +
        `┃ 📊 Level: *${oldLevel} → ${newLevel}*\n` +
        `┃ ${getRole(newLevel)}\n` +
        `╰┈┈┈┈┈┈┈┈⬡`,
        { mentions: [targetJid] }
    )
}

module.exports = {
    config: pluginConfig,
    handler
}
