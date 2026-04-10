const { fileTypeFromBuffer } = require('file-type')
const fs = require('fs')
const path = require('path')
const { config } = require('../../config')
const { generateWAMessageFromContent, proto } = require('ourin')
const crypto = require('crypto')
const botConfig = config

const pluginConfig = {
    name: 'swgc',
    alias: ['statusgrup', 'swgroup', 'groupstory', 'toswgc'],
    category: 'owner',
    description: 'Post Group Status/Story to selected groups (green border)',
    usage: '.swgc <text> or reply to media',
    example: '.swgc Hello everyone!',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

const pendingSwgc = new Map()

async function sendGroupStatus(sock, jid, content) {
    const { generateWAMessageContent } = require('ourin')
    const inside = await generateWAMessageContent(content, {
        upload: sock.waUploadToServer
    })
    const messageSecret = crypto.randomBytes(32)
    const m = generateWAMessageFromContent(jid, {
        messageContextInfo: {
            messageSecret
        },
        groupStatusMessageV2: {
            message: {
                ...inside,
                messageContextInfo: {
                    messageSecret
                }
            }
        }
    }, {})
    await sock.relayMessage(jid, m.message, {
        messageId: m.key.id
    })
    return m
}

async function handler(m, { sock, db }) {
    const args = m.args || []
    const text = m.text || ''
    
    if (args[0] === '--confirm' && args[1]) {
        const targetGroupId = args[1]
        const pendingData = pendingSwgc.get(m.sender)
        
        if (!pendingData) {
            await m.reply(`⚠️ *No pending data. Please resend media + .swgc*`)
            return
        }
        
        try {
            let groupName = 'Group'
            try {
                const meta = await sock.groupMetadata(targetGroupId)
                groupName = meta.subject
            } catch (e) {}
            
            await m.reply(`⏳ *Posting group story to ${groupName}...*`)
            
            const rawContent = pendingData.rawContent
            let content = {}
            
            if (rawContent.image) {
                content = { image: rawContent.image, caption: rawContent.caption || '' }
            } else if (rawContent.video) {
                content = { video: rawContent.video, caption: rawContent.caption || '' }
            } else if (rawContent.text) {
                content = { text: rawContent.text }
            }
            
            await sendGroupStatus(sock, targetGroupId, content)
            
            const mediaType = pendingData.rawContent.text ? 'Text' 
                            : pendingData.rawContent.image ? 'Image' 
                            : 'Video'
            
            const successMsg = `✅ *ɢʀᴏᴜᴘ sᴛᴏʀʏ ᴘᴏsᴛᴇᴅ*

╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟs* 」
┃ ㊗ 📡 sᴛᴀᴛᴜs: *🟢 Success*
┃ ㊗ 🏠 ɢʀᴏᴜᴘ: *${groupName}*
┃ ㊗ 📝 ᴛʏᴘᴇ: *${mediaType}*
╰┈┈⬡

> _Group icon now has a green border!_
> _Members can see the group story._`
            
            await m.reply(successMsg)
            pendingSwgc.delete(m.sender)
            
            if (pendingData.tempFile && fs.existsSync(pendingData.tempFile)) {
                setTimeout(() => {
                    try { fs.unlinkSync(pendingData.tempFile) } catch (e) {}
                }, 5000)
            }
            
        } catch (error) {
            await m.reply(
                `❌ *ᴇʀʀᴏʀ*\n\n` +
                `> Failed to post story.\n` +
                `> _${error.message}_`
            )
        }
        return
    }
    
    let rawContent = {}
    let buffer, ext, tempFile
    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    
    if (m.quoted && (m.quoted.isImage || m.quoted.isVideo)) {
        try {
            buffer = await m.quoted.download()
            if (!buffer) {
                await m.reply(`❌ Failed to retrieve media.`)
                return
            }
            const fileType = await fileTypeFromBuffer(buffer)
            ext = fileType?.ext || 'bin'
            tempFile = path.join(tempDir, `swgc_${Date.now()}.${ext}`)
            fs.writeFileSync(tempFile, buffer)
            
            if (m.quoted.isImage) {
                rawContent.image = buffer
                rawContent.caption = text || ''
            } else if (m.quoted.isVideo) {
                rawContent.video = buffer
                rawContent.caption = text || ''
            }
        } catch (e) {
            await m.reply(`❌ Media processing failed: ${e.message}`)
            return
        }
    } else if (m.isImage || m.isVideo) {
        try {
            buffer = await m.download()
            if (!buffer) {
                await m.reply(`❌ Failed to retrieve media.`)
                return
            }
            const fileType = await fileTypeFromBuffer(buffer)
            ext = fileType?.ext || 'bin'
            tempFile = path.join(tempDir, `swgc_${Date.now()}.${ext}`)
            fs.writeFileSync(tempFile, buffer)
            
            if (m.isImage) {
                rawContent.image = buffer
                rawContent.caption = text || ''
            } else if (m.isVideo) {
                rawContent.video = buffer
                rawContent.caption = text || ''
            }
        } catch (e) {
            await m.reply(`❌ Media processing failed: ${e.message}`)
            return
        }
    } else if (text && text.trim()) {
        rawContent.text = text
        rawContent.font = 0
        rawContent.backgroundColor = '#128C7E'
    } else {
        await m.reply(
            `⚠️ *ʜᴏᴡ ᴛᴏ ᴜsᴇ*\n\n` +
            `> \`${m.prefix}swgc text\` - Text story\n` +
            `> Reply to image/video + \`${m.prefix}swgc\`\n` +
            `> Send image/video + caption \`${m.prefix}swgc\``
        )
        return
    }
    
    pendingSwgc.set(m.sender, {
        rawContent: rawContent,
        tempFile: tempFile,
        timestamp: Date.now()
    })
    
    try {
        global.isFetchingGroups = true
        const groups = await sock.groupFetchAllParticipating()
        global.isFetchingGroups = false
        const groupList = Object.entries(groups)
        
        if (groupList.length === 0) {
            await m.reply(`⚠️ *Bot is not in any group.*`)
            return
        }
        
        const groupRows = groupList.map(([id, meta]) => ({
            header: meta.subject || 'Unknown Group',
            id: `${m.prefix}swgc --confirm ${id}`,
            title: meta.subject || 'Unknown Group',
            description: id.split('@')[0]
        }))
        
        const prefix = m.prefix || '.'
        const mediaType = rawContent.text ? 'Text' : rawContent.image ? 'Image' : 'Video'
        
        let thumbnail = null
        try {
            thumbnail = fs.readFileSync('./assets/images/ourin2.jpg')
        } catch (e) {}
        
        // Build interactive message
        const interactiveMessage = {
            body: proto.Message.InteractiveMessage.Body.fromObject({
                text: `📋 *sᴇʟᴇᴄᴛ ɢʀᴏᴜᴘ ᴛᴏ ᴘᴏsᴛ sᴛᴏʀʏ*\n\n` +
                      `> Media: *${mediaType}*\n` +
                      `> Total Groups: *${groupList.length}*\n\n` +
                      `_Select a group from the list below:_`
            }),
            footer: proto.Message.InteractiveMessage.Footer.fromObject({
                text: 'OURIN MD'
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                buttons: [
                    {
                        name: 'single_select',
                        buttonParamsJson: JSON.stringify({
                            title: '🏠 Select Group',
                            sections: [{
                                title: 'Group List',
                                rows: groupRows
                            }]
                        })
                    },
                    {
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: '❌ Cancel',
                            id: `${prefix}cancelswgc`
                        })
                    }
                ]
            }),
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: botConfig?.saluran?.id,
                    newsletterName: botConfig?.saluran?.name,
                    serverMessageId: 127
                },
                externalAdReply: thumbnail ? {
                    title: botConfig.bot?.name || 'Ourin MD',
                    body: 'GROUP STORY',
                    thumbnail: thumbnail,
                    sourceUrl: botConfig.saluran?.link || '',
                    mediaType: 1,
                    renderLargerThumbnail: false
                } : undefined
            }
        }
        
        const msg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject(interactiveMessage)
                }
            }
        }, { userJid: m.sender, quoted: m })
        
        await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
        
    } catch (error) {
        await m.reply(
            `❌ *ᴇʀʀᴏʀ*\n\n` +
            `> Failed to retrieve group list.\n` +
            `> _${error.message}_`
        )
        if (tempFile && fs.existsSync(tempFile)) {
            try { fs.unlinkSync(tempFile) } catch (e) {}
        }
        pendingSwgc.delete(m.sender)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}