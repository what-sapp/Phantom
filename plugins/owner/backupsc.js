const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const config = require('../../config')

const pluginConfig = {
    name: 'backupsc',
    alias: ['backup', 'backupscript', 'backupsource'],
    category: 'owner',
    description: 'Backup script bot dalam bentuk zip di root folder',
    usage: '.backupsc',
    example: '.backupsc',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 60,
    energi: 0,
    isEnabled: true
}

const EXCLUDE_DIRS = [
    'node_modules',
    '.git',
    'storage',
    'tmp',
    'temp',
    '.cache',
    'logs',
    'sessions',
    'auth',
    '.npm',
    '.yarn',
    'Marin Kitagawa MD V1.0 (1)'
]

const EXCLUDE_FILES = [
    '.env',
    '.env.local',
    'creds.json',
    '*.log',
    '*.zip',
    'package-lock.json',
    'yarn.lock'
]

function shouldExclude(filePath, basePath) {
    const relativePath = path.relative(basePath, filePath)
    const parts = relativePath.split(path.sep)
    
    for (const part of parts) {
        if (EXCLUDE_DIRS.includes(part)) return true
    }
    
    const fileName = path.basename(filePath)
    for (const pattern of EXCLUDE_FILES) {
        if (pattern.includes('*')) {
            const ext = pattern.replace('*', '')
            if (fileName.endsWith(ext)) return true
        } else {
            if (fileName === pattern) return true
        }
    }
    
    return false
}

async function handler(m, { sock }) {
    m.react('⏳')
    
    await m.reply(`📦 *ʙᴀᴄᴋᴜᴘ sᴄʀɪᴘᴛ*\n\n> Memproses backup...\n> Mohon tunggu sebentar...`)
    
    try {
        const projectRoot = process.cwd()
        const moment = require('moment-timezone')
        const timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DD_HH-mm-ss')
        const botName = config.bot?.name?.replace(/[^a-zA-Z0-9]/g, '') || 'OurinBot'
        const zipFileName = `${botName}_backup_${timestamp}.zip`
        const zipFilePath = path.join(projectRoot, zipFileName)
        
        const output = fs.createWriteStream(zipFilePath)
        const archive = archiver('zip', { zlib: { level: 9 } })
        
        await new Promise((resolve, reject) => {
            output.on('close', resolve)
            archive.on('error', reject)
            
            archive.pipe(output)
            
            function addDirectory(dirPath) {
                try {
                    const items = fs.readdirSync(dirPath)
                    
                    for (const item of items) {
                        const fullPath = path.join(dirPath, item)
                        
                        if (shouldExclude(fullPath, projectRoot)) continue
                        
                        try {
                            const stat = fs.statSync(fullPath)
                            const relativePath = path.relative(projectRoot, fullPath)
                            
                            if (stat.isDirectory()) {
                                addDirectory(fullPath)
                            } else if (stat.isFile()) {
                                archive.file(fullPath, { name: relativePath })
                            }
                        } catch (e) {
                            console.log(`[Backup] Skip: ${fullPath}`)
                        }
                    }
                } catch (e) {
                    console.log(`[Backup] Error reading: ${dirPath}`)
                }
            }
            
            addDirectory(projectRoot)
            archive.finalize()
        })
        
        const stats = fs.statSync(zipFilePath)
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)
        
        const saluranId = config.saluran?.id || '120363401718869058@newsletter'
        const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
        
        await sock.sendMessage(m.chat, {
            document: fs.readFileSync(zipFilePath),
            fileName: zipFileName,
            mimetype: 'application/zip',
            caption: `✅ *ʙᴀᴄᴋᴜᴘ sᴇʟᴇsᴀɪ*\n\n` +
                `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
                `┃ 📝 ɴᴀᴍᴀ: \`${zipFileName}\`\n` +
                `┃ 📊 sɪᴢᴇ: \`${fileSizeMB} MB\`\n` +
                `┃ 📅 ᴛᴀɴɢɢᴀʟ: \`${moment().tz('Asia/Jakarta').format('DD/MM/YYYY')}\`\n` +
                `┃ 📂 ʟᴏᴋᴀsɪ: \`Root folder\`\n` +
                `╰┈┈⬡\n\n` +
                `> Exclude: node_modules, .git, storage, logs`,
            contextInfo: {
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127
                }
            }
        }, { quoted: m })
        
        m.react('✅')
        
        await m.reply(`📂 *ʟᴏᴋᴀsɪ ꜰɪʟᴇ*\n\n> \`${zipFilePath}\``)
        
    } catch (error) {
        m.react('❌')
        m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${error.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
