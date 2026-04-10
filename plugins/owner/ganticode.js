const fs = require('fs')
const path = require('path')
const { hotReloadPlugin } = require('../../src/lib/plugins')

const pluginConfig = {
    name: 'ganticode',
    alias: ['replaceplugin', 'updateplugin', 'gantiplugin'],
    category: 'owner',
    description: 'Ganti code plugin yang sudah ada',
    usage: '.ganticode [namafile] [folder]',
    example: '.ganticode ping main',
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

function findPluginFile(pluginsDir, name) {
    const folders = fs.readdirSync(pluginsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
    
    for (const folder of folders) {
        const folderPath = path.join(pluginsDir, folder)
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))
        
        for (const file of files) {
            const baseName = file.replace('.js', '')
            if (baseName.toLowerCase() === name.toLowerCase()) {
                return {
                    folder,
                    file,
                    path: path.join(folderPath, file)
                }
            }
        }
    }
    
    return null
}

async function handler(m, { sock }) {
    const quoted = m.quoted
    
    if (!quoted) {
        return m.reply(
            `🔄 *ɢᴀɴᴛɪ ᴄᴏᴅᴇ*\n\n` +
            `> Reply code plugin baru dengan caption:\n` +
            `> \`${m.prefix}ganticode\` - Auto detect\n` +
            `> \`${m.prefix}ganticode namafile\` - Custom nama\n` +
            `> \`${m.prefix}ganticode namafile folder\` - Custom nama + folder\n\n` +
            `⚠️ *ᴘᴇʀɪɴɢᴀᴛᴀɴ:*\n` +
            `> Code lama akan di-backup sebelum diganti`
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
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Tidak bisa mendeteksi nama plugin\n> Gunakan \`${m.prefix}ganticode <namafile>\``)
    }
    
    fileName = fileName.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    if (!fileName) {
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Nama file tidak valid`)
    }
    
    m.react('⏳')
    
    try {
        const pluginsDir = path.join(process.cwd(), 'plugins')
        
        const existing = findPluginFile(pluginsDir, fileName)
        
        let filePath
        let targetFolder
        let isNewFile = false
        let backupPath = null
        let oldSize = 0
        
        if (existing) {
            filePath = existing.path
            targetFolder = existing.folder
            oldSize = fs.statSync(filePath).size
            
            const backupDir = path.join(process.cwd(), 'backup', 'plugins')
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true })
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
            backupPath = path.join(backupDir, `${fileName}_${timestamp}.js`)
            
            fs.copyFileSync(filePath, backupPath)
        } else {
            if (!folderName) {
                folderName = 'other'
            }
            folderName = folderName.toLowerCase().replace(/[^a-z0-9]/g, '')
            
            targetFolder = folderName
            const folderPath = path.join(pluginsDir, targetFolder)
            
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true })
            }
            
            filePath = path.join(folderPath, `${fileName}.js`)
            isNewFile = true
        }
        
        fs.writeFileSync(filePath, code)
        
        const reloadResult = hotReloadPlugin(filePath)
        
        m.react('✅')
        
        let replyText = `✅ *ᴄᴏᴅᴇ ${isNewFile ? 'ᴅɪᴛᴀᴍʙᴀʜ' : 'ᴅɪɢᴀɴᴛɪ'}*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📝 ɴᴀᴍᴀ: \`${fileName}.js\`\n` +
            `┃ 📁 ꜰᴏʟᴅᴇʀ: \`${targetFolder}\`\n` +
            `┃ 📊 sɪᴢᴇ: \`${code.length} bytes\`\n`
        
        if (!isNewFile) {
            replyText += `┃ 📦 ᴏʟᴅ sɪᴢᴇ: \`${oldSize} bytes\`\n`
        }
        
        replyText += `┃ 🔄 ʜᴏᴛ ʀᴇʟᴏᴀᴅ: ${reloadResult.success ? '✅ Sukses' : '⚠️ Pending'}\n` +
            `╰┈┈⬡\n\n`
        
        if (backupPath) {
            const relBackup = path.relative(process.cwd(), backupPath)
            replyText += `💾 *ʙᴀᴄᴋᴜᴘ:*\n> \`${relBackup}\`\n\n`
        }
        
        replyText += `> Plugin sudah aktif dan siap digunakan!`
        
        return m.reply(replyText)
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${error.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
