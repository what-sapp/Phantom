const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'dellist',
    alias: ['hapuslist', 'removelist'],
    category: 'store',
    description: 'Hapus list/command store',
    usage: '.dellist <nama>',
    example: '.dellist freefire',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const listName = m.args[0]?.toLowerCase().trim()
    
    if (!listName) {
        return m.reply(
            `🗑️ *ᴅᴇʟ ʟɪsᴛ sᴛᴏʀᴇ*\n\n` +
            `> Ketik: \`${m.prefix}dellist <nama>\`\n\n` +
            `\`Contoh: ${m.prefix}dellist freefire\``
        )
    }
    
    const storeData = db.setting('storeList') || {}
    
    if (!storeData[listName]) {
        const availableLists = Object.keys(storeData)
        if (availableLists.length === 0) {
            return m.reply(`❌ Tidak ada list yang tersedia!`)
        }
        return m.reply(
            `❌ List \`${listName}\` tidak ditemukan!\n\n` +
            `> List tersedia: ${availableLists.map(l => `\`${l}\``).join(', ')}`
        )
    }
    
    delete storeData[listName]
    db.setting('storeList', storeData)
    
    m.react('✅')
    
    return m.reply(
        `✅ *ʟɪsᴛ ᴅɪʜᴀᴘᴜs*\n\n` +
        `> Nama: \`${listName}\`\n` +
        `> Command \`${m.prefix}${listName}\` tidak lagi tersedia`
    )
}

module.exports = {
    config: pluginConfig,
    handler
}
