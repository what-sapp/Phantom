const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'level',
    alias: ['lvl', 'ceklevel'],
    category: 'user',
    description: 'Cek level user',
    usage: '.level [@user]',
    example: '.level',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

function calculateLevel(exp) {
    return Math.floor(exp / 20000) + 1
}

function expForLevel(level) {
    return (level - 1) * 20000
}

function expToNextLevel(exp) {
    const currentLevel = calculateLevel(exp)
    const nextLevelExp = expForLevel(currentLevel + 1)
    return nextLevelExp - exp
}

function getRole(level) {
    if (level >= 100) return '🐉 Mythic'
    if (level >= 80) return '⚔️ Legend'
    if (level >= 60) return '💜 Epic'
    if (level >= 40) return '💪 Grandmaster'
    if (level >= 20) return '🎖️ Master'
    if (level >= 10) return '⭐ Elite'
    return '🛡️ Warrior'
}

function getLevelBar(current, target) {
    const totalBars = 10
    const filledBars = Math.min(Math.floor((current / target) * totalBars), totalBars)
    const emptyBars = totalBars - filledBars
    return '▰'.repeat(filledBars) + '▱'.repeat(emptyBars)
}

async function handler(m, { sock }) {
    const db = getDatabase()
    
    let targetJid = m.sender
    let targetName = m.pushName || 'Kamu'
    
    if (m.quoted) {
        targetJid = m.quoted.sender
        targetName = m.quoted.pushName || targetJid.split('@')[0]
    } else if (m.mentionedJid?.length) {
        targetJid = m.mentionedJid[0]
        targetName = targetJid.split('@')[0]
    }
    
    const user = db.getUser(targetJid) || db.setUser(targetJid)
    if (!user.rpg) user.rpg = {}
    
    const exp = user.rpg.exp || 0
    const level = calculateLevel(exp)
    const role = getRole(level)
    const currentLevelExp = expForLevel(level)
    const nextLevelExp = expForLevel(level + 1)
    const expInLevel = exp - currentLevelExp
    const expNeeded = nextLevelExp - currentLevelExp
    const progress = getLevelBar(expInLevel, expNeeded)
    
    let txt = `╭━━━━━━━━━━━━━━━━━╮\n`
    txt += `┃ 📊 *ʟᴇᴠᴇʟ ɪɴꜰᴏ*\n`
    txt += `╰━━━━━━━━━━━━━━━━━╯\n\n`
    
    txt += `╭┈┈⬡「 👤 *ᴜsᴇʀ* 」\n`
    txt += `┃ 🏷️ Name: *${targetName}*\n`
    txt += `┃ 🆔 Tag: @${targetJid.split('@')[0]}\n`
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
    
    txt += `╭┈┈⬡「 📈 *sᴛᴀᴛs* 」\n`
    txt += `┃ 📊 Level: *${level}*\n`
    txt += `┃ ${role}\n`
    txt += `┃ 🚄 Exp: *${exp.toLocaleString('id-ID')}*\n`
    txt += `┃ 📊 Progress:\n`
    txt += `┃ ${progress}\n`
    txt += `┃ ${expInLevel.toLocaleString('id-ID')} / ${expNeeded.toLocaleString('id-ID')}\n`
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`
    
    txt += `> Next level: *${expToNextLevel(exp).toLocaleString('id-ID')} exp* lagi!`
    
    await m.reply(txt, { mentions: [targetJid] })
}

module.exports = {
    config: pluginConfig,
    handler,
    calculateLevel,
    expForLevel,
    expToNextLevel,
    getRole
}
