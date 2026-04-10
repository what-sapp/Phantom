const fs = require('fs')
const path = require('path')
const { hotReloadPlugin } = require('../../src/lib/plugins')

const pluginConfig = {
    name: 'addplugin',
    alias: ['addpl', 'tambahplugin'],
    category: 'owner',
    description: 'Tambah plugin baru dari code yang di-reply',
    usage: '.addplugin [namafile] [folder]',
    example: '.addplugin bliblidl downloader',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

function extractPluginInfo(code) {
    const info = { name: null, category: null }
    
    const nameMatch = code.match(/name:\s*['"`]([^'"`]+)['"`]/i)
    if (nameMatch) info.name = nameMatch[1]
    
    const categoryMatch = code.match(/category:\s*['"`]([^'"`]+)['"`]/i)
    if (categoryMatch) info.category = categoryMatch[1]
    
    return info
}

async function handler(m, { sock }) {
    const quoted = m.quoted
    
    if (!quoted) {
        return m.reply(
            `📦 *ᴀᴅᴅ ᴘʟᴜɢɪɴ*\n\n` +
            `> Reply code plugin dengan caption:\n` +
            `> \`${m.prefix}addplugin\` - Auto detect\n` +
            `> \`${m.prefix}addplugin namafile\` - Custom nama\n` +
            `> \`${m.prefix}addplugin namafile folder\` - Custom nama + folder`
        )
    }
    
    let code = quoted.text || quoted.body || ''
    
    if (quoted.mimetype === 'application/javascript' || quoted.filename?.endsWith('.js')) {
        try {
            code = (await quoted.download()).toString()
        } catch (e) {
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Gagal download file`)
        }
    }
    
    if (!code || code.length < 50) {
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Code terlalu pendek atau tidak valid`)
    }
    
    if (!code.includes('module.exports') && !code.includes('pluginConfig')) {
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Code bukan format plugin yang valid\n> Harus ada \`module.exports\` dan \`pluginConfig\``)
    }
    
    const extracted = extractPluginInfo(code)
    const args = m.args
    
    let fileName = args[0] || extracted.name
    let folderName = args[1] || extracted.category
    
    if (!fileName) {
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Tidak bisa mendeteksi nama plugin\n> Gunakan \`${m.prefix}addplugin <namafile>\``)
    }
    
    if (!folderName) {
        folderName = 'other'
    }
    
    fileName = fileName.toLowerCase().replace(/[^a-z0-9]/g, '')
    folderName = folderName.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    if (!fileName) {
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Nama file tidak valid`)
    }
    
    m.react('⏳')
    
    try {
        const pluginsDir = path.join(process.cwd(), 'plugins')
        const folderPath = path.join(pluginsDir, folderName)
        const filePath = path.join(folderPath, `${fileName}.js`)
        
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true })
        }
        
        if (fs.existsSync(filePath)) {
            m.react('❌')
            return m.reply(
                `❌ *ɢᴀɢᴀʟ*\n\n` +
                `> File \`${fileName}.js\` sudah ada di folder \`${folderName}\`\n\n` +
                `💡 *ᴛɪᴘ:* Gunakan \`${m.prefix}ganticode ${fileName} ${folderName}\` untuk mengganti code yang sudah ada`
            )
        }
        
        fs.writeFileSync(filePath, code)
        
        const reloadResult = hotReloadPlugin(filePath)
        
        m.react('✅')
        return m.reply(
            `✅ *ᴘʟᴜɢɪɴ ᴅɪᴛᴀᴍʙᴀʜ*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📝 ɴᴀᴍᴀ: \`${fileName}.js\`\n` +
            `┃ 📁 ꜰᴏʟᴅᴇʀ: \`${folderName}\`\n` +
            `┃ 📊 sɪᴢᴇ: \`${code.length} bytes\`\n` +
            `┃ 🔄 ʜᴏᴛ ʀᴇʟᴏᴀᴅ: ${reloadResult.success ? '✅ Sukses' : '⚠️ Pending'}\n` +
            `╰┈┈⬡\n\n` +
            `> Plugin sudah aktif dan siap digunakan!`
        )
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${error.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
