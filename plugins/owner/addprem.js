const config = require('../../config')
const { getDatabase } = require('../../src/lib/database')
const { addJadibotPremium, removeJadibotPremium, getJadibotPremiums } = require('../../src/lib/jadibotDatabase')

const pluginConfig = {
    name: 'addprem',
    alias: ['addpremium', 'setprem', 'delprem', 'delpremium', 'listprem', 'premlist'],
    category: 'owner',
    description: 'Kelola premium users',
    usage: '.addprem <nomor/@tag>',
    example: '.addprem 6281234567890',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock, jadibotId, isJadibot }) {
    const db = getDatabase()
    const cmd = m.command.toLowerCase()
    
    const isAdd = ['addprem', 'addpremium', 'setprem'].includes(cmd)
    const isDel = ['delprem', 'delpremium'].includes(cmd)
    const isList = ['listprem', 'premlist'].includes(cmd)
    
    if (!db.data.premium) db.data.premium = []
    
    if (isList) {
        if (isJadibot && jadibotId) {
            const jbPremiums = getJadibotPremiums(jadibotId)
            if (jbPremiums.length === 0) {
                return m.reply(`💎 *ᴅᴀꜰᴛᴀʀ ᴘʀᴇᴍɪᴜᴍ ᴊᴀᴅɪʙᴏᴛ*\n\n> Belum ada premium terdaftar.\n> Gunakan \`${m.prefix}addprem\` untuk menambah.`)
            }
            let txt = `💎 *ᴅᴀꜰᴛᴀʀ ᴘʀᴇᴍɪᴜᴍ ᴊᴀᴅɪʙᴏᴛ*\n\n`
            txt += `> Bot: *${jadibotId}*\n`
            txt += `> Total: *${jbPremiums.length}* premium\n\n`
            jbPremiums.forEach((p, i) => {
                const num = typeof p === 'string' ? p : p.jid
                txt += `${i + 1}. 💎 \`${num}\`\n`
            })
            return m.reply(txt)
        }
        
        if (db.data.premium.length === 0) {
            return m.reply(`💎 *ᴅᴀꜰᴛᴀʀ ᴘʀᴇᴍɪᴜᴍ*\n\n> Belum ada premium terdaftar.`)
        }
        let txt = `💎 *ᴅᴀꜰᴛᴀʀ ᴘʀᴇᴍɪᴜᴍ*\n\n`
        txt += `> Total: *${db.data.premium.length}* premium\n\n`
        
        const now = Date.now()
        db.data.premium.forEach((p, i) => {
            const num = typeof p === 'string' ? p : p.id
            const name = typeof p === 'object' ? (p.name || 'Unknown') : 'Unknown'
            const expDate = typeof p === 'object' && p.expired 
                ? new Date(p.expired).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Permanent'
            const remaining = typeof p === 'object' && p.expired 
                ? Math.ceil((p.expired - now) / (1000 * 60 * 60 * 24))
                : '∞'
            
            txt += `${i + 1}. 💎 \`${num}\`\n`
            if (typeof p === 'object') {
                txt += `   > ${name} • ${expDate} (${remaining} hari)\n`
            }
        })
        return m.reply(txt)
    }
    
    let targetNumber = ''
    if (m.quoted) {
        targetNumber = m.quoted.sender?.replace(/[^0-9]/g, '') || ''
    } else if (m.mentionedJid?.length) {
        targetNumber = m.mentionedJid[0]?.replace(/[^0-9]/g, '') || ''
    } else if (m.args[0]) {
        targetNumber = m.args[0].replace(/[^0-9]/g, '')
    }
    
    if (!targetNumber) {
        return m.reply(`💎 *${isAdd ? 'ADD' : 'DEL'} ᴘʀᴇᴍɪᴜᴍ*\n\n> Masukkan nomor atau tag user\n\n\`Contoh: ${m.prefix}${cmd} 6281234567890\``)
    }
    
    if (targetNumber.startsWith('0')) {
        targetNumber = '62' + targetNumber.slice(1)
    }
    
    if (targetNumber.length < 10 || targetNumber.length > 15) {
        return m.reply(`❌ Format nomor tidak valid`)
    }
    
    if (isJadibot && jadibotId) {
        if (isAdd) {
            if (addJadibotPremium(jadibotId, targetNumber)) {
                m.react('💎')
                return m.reply(
                    `💎 *ᴘʀᴇᴍɪᴜᴍ ᴊᴀᴅɪʙᴏᴛ ᴅɪᴛᴀᴍʙᴀʜᴋᴀɴ*\n\n` +
                    `> Bot: \`${jadibotId}\`\n` +
                    `> Nomor: \`${targetNumber}\`\n` +
                    `> Total: *${getJadibotPremiums(jadibotId).length}* premium`
                )
            } else {
                return m.reply(`❌ \`${targetNumber}\` sudah premium di Jadibot ini.`)
            }
        } else if (isDel) {
            if (removeJadibotPremium(jadibotId, targetNumber)) {
                m.react('✅')
                return m.reply(
                    `✅ *ᴘʀᴇᴍɪᴜᴍ ᴊᴀᴅɪʙᴏᴛ ᴅɪʜᴀᴘᴜs*\n\n` +
                    `> Bot: \`${jadibotId}\`\n` +
                    `> Nomor: \`${targetNumber}\`\n` +
                    `> Total: *${getJadibotPremiums(jadibotId).length}* premium`
                )
            } else {
                return m.reply(`❌ \`${targetNumber}\` bukan premium di Jadibot ini.`)
            }
        }
        return
    }
    
    if (isAdd) {
        // Find existing
        const existingIndex = db.data.premium.findIndex(p => 
            typeof p === 'string' ? p === targetNumber : p.id === targetNumber
        )
        
        const days = parseInt(m.args?.find(a => /^\d+$/.test(a) && a.length <= 4)) || 30
        const pushName = m.quoted?.pushName || m.pushName || 'Unknown'
        const now = Date.now()
        
        let newExpired
        let message = ''
        
        if (existingIndex !== -1) {
            const currentData = db.data.premium[existingIndex]
            const currentExpired = typeof currentData === 'string' ? now : (currentData.expired || now)
            const baseTime = currentExpired > now ? currentExpired : now
            newExpired = baseTime + (days * 24 * 60 * 60 * 1000)
            
            if (typeof currentData === 'string') {
                db.data.premium[existingIndex] = {
                    id: targetNumber,
                    expired: newExpired,
                    name: pushName,
                    addedAt: now
                }
            } else {
                db.data.premium[existingIndex].expired = newExpired
                db.data.premium[existingIndex].name = pushName
            }
            message = `Premium diperpanjang`
        } else {
            newExpired = now + (days * 24 * 60 * 60 * 1000)
            db.data.premium.push({
                id: targetNumber,
                expired: newExpired,
                name: pushName,
                addedAt: now
            })
            message = `Berhasil ditambahkan`
        }
        
        const jid = targetNumber + '@s.whatsapp.net'
        const premLimit = config.limits?.premium || 100
        const user = db.getUser(jid) || db.setUser(jid)
        
        user.energi = premLimit
        user.isPremium = true
        
        db.setUser(jid, user)
        db.updateExp(jid, 200000)
        db.updateKoin(jid, 20000)
        
        db.save()
        
        const expDate = new Date(newExpired).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
        })
        
        m.react('💎')
        return m.reply(
            `💎 *ᴘʀᴇᴍɪᴜᴍ ᴅɪᴛᴀᴍʙᴀʜᴋᴀɴ*\n\n` +
            `> Nomor: \`${targetNumber}\`\n` +
            `> Durasi: *${days} hari*\n` +
            `> Expired: *${expDate}*\n` +
            `> ${message}\n\n` +
            `🎁 *ʙᴏɴᴜs:*\n` +
            `> ⚡ Energi: *${premLimit}*\n` +
            `> 🆙 Exp: *+200.000*\n` +
            `> 💰 Koin: *+20.000*`
        )
    } else if (isDel) {
        const index = db.data.premium.findIndex(p => 
            typeof p === 'string' ? p === targetNumber : p.id === targetNumber
        )
        
        if (index === -1) {
            return m.reply(`❌ \`${targetNumber}\` bukan premium`)
        }
        
        db.data.premium.splice(index, 1)
        
        const jid = targetNumber + '@s.whatsapp.net'
        const user = db.getUser(jid)
        if (user) {
            user.isPremium = false
            db.setUser(jid, user)
        }
        
        db.save()
        
        m.react('✅')
        return m.reply(
            `✅ *ᴘʀᴇᴍɪᴜᴍ ᴅɪʜᴀᴘᴜs*\n\n` +
            `> Nomor: \`${targetNumber}\`\n` +
            `> Total: *${db.data.premium.length}* premium`
        )
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
