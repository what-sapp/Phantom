const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'delpremall',
    alias: ['delpremiumall', 'removepremall'],
    category: 'owner',
    description: 'Menghapus semua member grup dari premium',
    usage: '.delpremall',
    example: '.delpremall',
    isOwner: true,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    try {
        const groupMeta = m.groupMetadata
        const participants = groupMeta.participants || []

        if (participants.length === 0) {
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Tidak ada member di grup ini`)
        }

        m.react('⏳')

        const db = getDatabase()
        if (!db.data.premium) db.data.premium = []

        let removedCount = 0
        let notPremCount = 0

        for (const participant of participants) {
            const number = participant.jid?.replace(/[^0-9]/g, '') || ''
            if (!number) continue

            const index = db.data.premium.findIndex(p =>
                typeof p === 'string' ? p === number : p.id === number
            )

            if (index === -1) {
                notPremCount++
                continue
            }

            db.data.premium.splice(index, 1)

            const jid = number + '@s.whatsapp.net'
            const user = db.getUser(jid)
            if (user) {
                user.isPremium = false
                db.setUser(jid, user)
            }

            removedCount++
        }

        db.save()

        m.react('🗑️')
        await m.reply(
            `🗑️ *ᴅᴇʟ ᴘʀᴇᴍɪᴜᴍ ᴀʟʟ*\n\n` +
            `╭┈┈⬡「 📋 *ʜᴀsɪʟ* 」\n` +
            `┃ 👥 ᴛᴏᴛᴀʟ ᴍᴇᴍʙᴇʀ: \`${participants.length}\`\n` +
            `┃ ✅ ᴅɪʜᴀᴘᴜs: \`${removedCount}\`\n` +
            `┃ ⏭️ ʙᴜᴋᴀɴ ᴘʀᴇᴍɪᴜᴍ: \`${notPremCount}\`\n` +
            `┃ 💎 sɪsᴀ ᴘʀᴇᴍɪᴜᴍ: \`${db.data.premium.length}\`\n` +
            `╰┈┈⬡\n\n` +
            `> Grup: ${groupMeta.subject}`
        )

    } catch (error) {
        m.react('❌')
        await m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${error.message}`)
    }
}

module.exports = { config: pluginConfig, handler }
