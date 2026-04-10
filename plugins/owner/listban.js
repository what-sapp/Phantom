const config = require('../../config')

const pluginConfig = {
    name: 'listban',
    alias: ['listbanned', 'banlist'],
    category: 'owner',
    description: 'Melihat daftar banned user',
    usage: '.listban',
    example: '.listban',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const bannedUsers = config.bannedUsers || []
    
    if (bannedUsers.length === 0) {
        return m.reply(`🚫 *ʟɪsᴛ ʙᴀɴɴᴇᴅ*\n\n> Tidak ada user yang dibanned\n\n\`Gunakan: ${m.prefix}ban <nomor>\``)
    }
    
    let caption = `🚫 *ʟɪsᴛ ʙᴀɴɴᴇᴅ*\n\n`
    caption += `╭┈┈⬡「 ⛔ *ᴜsᴇʀs* 」\n`
    
    for (let i = 0; i < bannedUsers.length; i++) {
        caption += `┃ ${i + 1}. \`${bannedUsers[i]}\`\n`
    }
    
    caption += `╰┈┈⬡\n\n`
    caption += `> ᴛᴏᴛᴀʟ: \`${bannedUsers.length}\` ʙᴀɴɴᴇᴅ ᴜsᴇʀ`
    
    await m.reply(caption)
}

module.exports = {
    config: pluginConfig,
    handler
}
