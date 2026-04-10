const { getDatabase } = require('../../src/lib/database')

const pluginConfig = {
    name: 'setdone',
    alias: ['doneconfig', 'configdone'],
    category: 'store',
    description: 'Set template untuk .done',
    usage: '.setdone template <full text>',
    example: '.setdone template 「 *TRANSAKSI BERHASIL* 」\\n\\n⌚️ JAM : {jam}',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const defaultTemplate = `「 *TRANSAKSI BERHASIL* 」

⌚️ JAM     : {jam}
✨ STATUS  : Berhasil
*📝 Pesanan:*
{pesanan}

*📝 Note :*
{note}

Terimakasih @{buyer_number}, Next Order ya🙏`

async function handler(m, { sock }) {
    const db = getDatabase()
    const text = m.text?.trim() || ''
    const args = text.split(' ')
    const option = args[0]?.toLowerCase()
    
    const current = db.setting('doneTemplate') || {}
    
    if (!option) {
        let info = `⚙️ *sᴇᴛ ᴅᴏɴᴇ ᴛᴇᴍᴘʟᴀᴛᴇ*\n\n`
        info += `╭┈┈⬡「 📋 *ᴄᴜʀʀᴇɴᴛ sᴇᴛᴛɪɴɢs* 」\n`
        info += `┃ ▧ Template: ${current.template ? '✅ Custom' : '❌ Default'}\n`
        info += `╰┈┈┈┈┈┈┈┈⬡\n\n`
        info += `*ᴜsᴀɢᴇ:*\n\n`
        info += `1️⃣ *Set Template:*\n`
        info += `\`${m.prefix}setdone template <text>\`\n\n`
        info += `2️⃣ *Contoh:*\n`
        info += `\`\`\`\n${m.prefix}setdone template 「 *TRANSAKSI BERHASIL* 」\n\n⌚️ JAM : {jam}\n✨ STATUS : Berhasil\n📝 Pesanan: {pesanan}\n📝 Note: {note}\n\nTerimakasih @{buyer_number}!\n\`\`\`\n\n`
        info += `*ᴘʟᴀᴄᴇʜᴏʟᴅᴇʀs:*\n`
        info += `> {buyer} = Nama buyer\n`
        info += `> {buyer_number} = Nomor buyer\n`
        info += `> {jam} / {time} = Jam (HH.MM.SS)\n`
        info += `> {date} = Tanggal (DD-MM-YYYY)\n`
        info += `> {pesanan} / {title} / {produk} = Pesanan\n`
        info += `> {note} = Catatan\n\n`
        info += `3️⃣ *Reset ke Default:*\n`
        info += `\`${m.prefix}setdone reset\`\n\n`
        info += `4️⃣ *Preview Template:*\n`
        info += `\`${m.prefix}setdone preview\``
        
        return m.reply(info)
    }
    
    if (option === 'reset') {
        db.setting('doneTemplate', {})
        await db.save()
        return m.reply(`✅ Template .done direset ke default!`)
    }
    
    if (option === 'preview') {
        const template = current.template || defaultTemplate
        
        const now = new Date()
        const jam = `${now.getHours().toString().padStart(2, '0')}.${now.getMinutes().toString().padStart(2, '0')}.${now.getSeconds().toString().padStart(2, '0')}`
        const tanggal = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`
        
        const previewText = template
            .replace(/{buyer}/gi, 'Zann')
            .replace(/{buyer_number}/gi, '628123456789')
            .replace(/{jam}/gi, jam)
            .replace(/{time}/gi, jam)
            .replace(/{date}/gi, tanggal)
            .replace(/{pesanan}/gi, 'Canva Pro 1 Bulan')
            .replace(/{title}/gi, 'Canva Pro 1 Bulan')
            .replace(/{produk}/gi, 'Canva Pro 1 Bulan')
            .replace(/{note}/gi, 'Akun dikirim via chat')
        
        return m.reply(`📋 *ᴘʀᴇᴠɪᴇᴡ ᴛᴇᴍᴘʟᴀᴛᴇ:*\n\n${previewText}`)
    }
    
    if (option === 'template') {
        const templateText = m.fullArgs.slice(9).trim()
        
        if (!templateText) {
            return m.reply(`❌ Template tidak boleh kosong!\n\n> Gunakan \`${m.prefix}setdone\` untuk melihat contoh`)
        }
        
        current.template = templateText
        db.setting('doneTemplate', current)
        await db.save()
        
        return m.reply(`✅ *ᴛᴇᴍᴘʟᴀᴛᴇ ᴅɪsɪᴍᴘᴀɴ!*\n\n> Gunakan \`${m.prefix}setdone preview\` untuk melihat hasil`)
    }
    
    return m.reply(`❌ Option tidak valid!\n\n> Gunakan: \`template\`, \`preview\`, atau \`reset\``)
}

module.exports = {
    config: pluginConfig,
    handler
}
