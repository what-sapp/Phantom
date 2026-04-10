const config = require('../../config')

const pluginConfig = {
    name: 'acc',
    alias: ['accall', 'joinrequest', 'reqjoin'],
    category: 'group',
    description: 'Kelola permintaan masuk grup (accept/reject)',
    usage: '.acc <list|approve|reject> [all|nomor]',
    example: '.acc approve all',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    isBotAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

function formatDate(timestamp) {
    return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(timestamp * 1000))
}

async function handler(m, { sock }) {
    const args = m.args || []
    const sub = args[0]?.toLowerCase()
    const option = args.slice(1).join(' ')?.trim()

    if (!sub || !['list', 'approve', 'reject'].includes(sub)) {
        return m.reply(
            `📋 *ᴊᴏɪɴ ʀᴇQᴜᴇsᴛ ᴍᴀɴᴀɢᴇʀ*\n\n` +
            `╭┈┈⬡「 📌 *ᴄᴏᴍᴍᴀɴᴅ* 」\n` +
            `┃ ${m.prefix}acc list\n` +
            `┃ ${m.prefix}acc approve all\n` +
            `┃ ${m.prefix}acc reject all\n` +
            `┃ ${m.prefix}acc approve 1|2|3\n` +
            `┃ ${m.prefix}acc reject 1|2|3\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    await m.react('⏳')

    try {
        const pendingList = await sock.groupRequestParticipantsList(m.chat)

        if (!pendingList?.length) {
            await m.react('📭')
            return m.reply(`📭 Tidak ada permintaan masuk yang tertunda.`)
        }

        if (sub === 'list') {
            let text = `📋 *ᴅᴀꜰᴛᴀʀ ᴘᴇʀᴍɪɴᴛᴀᴀɴ ᴍᴀsᴜᴋ*\n\n`
            text += `> Total: ${pendingList.length} permintaan\n\n`

            for (let i = 0; i < pendingList.length; i++) {
                const req = pendingList[i]
                const number = req.jid?.split('@')[0] || 'Unknown'
                const method = req.request_method || '-'
                const time = req.request_time ? formatDate(req.request_time) : '-'

                text += `*${i + 1}.* @${number}\n`
                text += `   📱 ${number}\n`
                text += `   📨 ${method}\n`
                text += `   🕐 ${time}\n\n`
            }

            text += `> Gunakan \`${m.prefix}acc approve all\` atau \`${m.prefix}acc reject all\``

            const mentions = pendingList.map(r => r.jid)
            await m.react('📋')
            return m.reply(text, { mentions })
        }

        const action = sub

        if (option === 'all') {
            const jids = pendingList.map(r => r.jid)

            const results = await sock.groupRequestParticipantsUpdate(m.chat, jids, action)

            const success = results.filter(r => r.status === '200' || !r.status || r.status === 200).length
            const failed = results.length - success

            const label = action === 'approve' ? 'Diterima' : 'Ditolak'
            await m.react('✅')
            return m.reply(
                `✅ *${label.toUpperCase()} SEMUA*\n\n` +
                `> ✅ Berhasil: ${success}\n` +
                `> ❌ Gagal: ${failed}\n` +
                `> 📊 Total: ${results.length}`
            )
        }

        const indices = option.split('|').map(n => parseInt(n.trim()) - 1).filter(n => !isNaN(n) && n >= 0 && n < pendingList.length)

        if (!indices.length) {
            await m.react('❌')
            return m.reply(
                `❌ Nomor tidak valid.\n\n` +
                `> Gunakan \`${m.prefix}acc list\` untuk melihat daftar.\n` +
                `> Contoh: \`${m.prefix}acc ${action} 1|2|3\``
            )
        }

        const targets = indices.map(i => pendingList[i])
        let text = ''
        const label = action === 'approve' ? 'Diterima' : 'Ditolak'
        let successCount = 0

        for (const target of targets) {
            try {
                const result = await sock.groupRequestParticipantsUpdate(m.chat, [target.jid], action)
                const status = result[0]?.status
                const ok = status === '200' || !status || status === 200

                const number = target.jid.split('@')[0]
                text += `${ok ? '✅' : '❌'} ${number} — ${ok ? label : 'Gagal'}\n`
                if (ok) successCount++
            } catch {
                const number = target.jid.split('@')[0]
                text += `❌ ${number} — Error\n`
            }
        }

        await m.react('✅')
        return m.reply(
            `📋 *ʜᴀsɪʟ ${label.toUpperCase()}*\n\n` +
            text + `\n` +
            `> ✅ ${successCount}/${targets.length} berhasil`
        )
    } catch (error) {
        await m.react('❌')
        return m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${error.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
