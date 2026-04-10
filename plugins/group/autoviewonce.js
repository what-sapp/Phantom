const { downloadContentFromMessage } = require('ourin')
const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'autoviewonce',
    alias: ['autovo', 'openvo-auto'],
    category: 'group',
    description: 'Toggle auto buka pesan 1x lihat di grup',
    usage: '.autoviewonce on/off',
    example: '.autoviewonce on',
    isGroup: true,
    isAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const args = m.text?.trim().toLowerCase()
    const db = getDatabase()
    const groupData = db.getGroup(m.chat) || {}

    if (!args || !['on', 'off'].includes(args)) {
        const status = groupData.autoViewOnce ? '✅ Aktif' : '❌ Nonaktif'
        return m.reply(
            `👁️ *ᴀᴜᴛᴏ ᴠɪᴇᴡᴏɴᴄᴇ*\n\n` +
            `> Status: ${status}\n\n` +
            `Gunakan:\n` +
            `• \`${m.prefix}autoviewonce on\` — Aktifkan\n` +
            `• \`${m.prefix}autoviewonce off\` — Nonaktifkan`
        )
    }

    const enabled = args === 'on'
    db.setGroup(m.chat, { autoViewOnce: enabled })

    await m.reply(
        `👁️ *ᴀᴜᴛᴏ ᴠɪᴇᴡᴏɴᴄᴇ*\n\n` +
        `> Status: ${enabled ? '✅ Aktif' : '❌ Nonaktif'}\n\n` +
        (enabled
            ? '> Pesan viewonce di grup ini akan otomatis dibuka oleh bot.'
            : '> Bot tidak lagi membuka pesan viewonce otomatis.')
    )
}

async function onViewOnce(m, sock) {
    if (!m.isGroup || !m.isViewOnce) return
    if (m.fromMe) return

    const db = getDatabase()
    const groupData = db.getGroup(m.chat) || {}
    if (!groupData.autoViewOnce) return

    try {
        const raw = m.message
        const voWrapper = raw?.viewOnceMessage?.message ||
                          raw?.viewOnceMessageV2?.message ||
                          raw?.viewOnceMessageV2Extension?.message

        if (!voWrapper) return

        const type = Object.keys(voWrapper).find(k =>
            ['imageMessage', 'videoMessage', 'audioMessage'].includes(k)
        )
        if (!type) return

        const content = voWrapper[type]
        let mediaType = 'image'
        if (type.includes('video')) mediaType = 'video'
        else if (type.includes('audio')) mediaType = 'audio'

        const stream = await downloadContentFromMessage(content, mediaType)
        let buffer = Buffer.from([])
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }

        if (!buffer || buffer.length < 100) return

        const caption = content.caption || ''
        const senderNumber = m.senderNumber || m.sender?.split('@')[0] || 'Unknown'

        const msgContent = {
            caption: `👁️ *ᴠɪᴇᴡᴏɴᴄᴇ ᴅᴇᴛᴇᴄᴛᴇᴅ*\n\n` +
                `> Dari: @${senderNumber}\n` +
                (caption ? `> Caption: ${caption}` : ''),
            mentions: m.sender ? [m.sender] : []
        }

        if (mediaType === 'image') {
            msgContent.image = buffer
            await sock.sendMessage(m.chat, msgContent, { quoted: m })
        } else if (mediaType === 'video') {
            msgContent.video = buffer
            await sock.sendMessage(m.chat, msgContent, { quoted: m })
        } else if (mediaType === 'audio') {
            await sock.sendMessage(m.chat, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                ptt: true
            }, { quoted: m })
        }
    } catch (err) {
        console.error('[AutoViewOnce]', err.message)
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    onViewOnce
}
