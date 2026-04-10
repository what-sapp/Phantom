/**
 * 🐺 WEREWOLF GAME
 * Social deduction game for WhatsApp
 * 
 * Based on reference: RTXZY-MD-pro/lib/werewolf.js
 * Enhanced for OurinAI
 */

const { getDatabase } = require('../../src/lib/database')
const config = require('../../config')
const fs = require('fs')
const path = require('path')

const pluginConfig = {
    name: 'werewolf',
    alias: ['ww', 'wwgc'],
    category: 'game',
    description: 'Main Werewolf Game bersama player lain',
    usage: '.ww <create|join|start|vote|player|exit|delete>',
    example: '.ww create',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

if (!global.werewolfGames) global.werewolfGames = {}

let thumbWW = null
let thumbNight = null
let thumbDay = null
let thumbWin = null

try {
    const assetsPath = path.join(process.cwd(), 'assets', 'images')
    if (fs.existsSync(path.join(assetsPath, 'ourin-games.jpg'))) {
        thumbWW = fs.readFileSync(path.join(assetsPath, 'ourin-games.jpg'))
    }
    if (fs.existsSync(path.join(assetsPath, 'ourin.jpg'))) {
        thumbNight = fs.readFileSync(path.join(assetsPath, 'ourin.jpg'))
        thumbDay = fs.readFileSync(path.join(assetsPath, 'ourin.jpg'))
    }
    if (fs.existsSync(path.join(assetsPath, 'ourin-winner.jpg'))) {
        thumbWin = fs.readFileSync(path.join(assetsPath, 'ourin-winner.jpg'))
    }
} catch (e) {
    console.log('[WW] Failed to load thumbnails:', e.message)
}

const ROLES = {
    werewolf: { emoji: '🐺', name: 'Werewolf', team: 'wolf', desc: 'Bunuh warga tiap malam' },
    seer: { emoji: '🔮', name: 'Seer', team: 'village', desc: 'Lihat role player tiap malam' },
    guardian: { emoji: '🛡️', name: 'Guardian', team: 'village', desc: 'Lindungi player tiap malam' },
    sorcerer: { emoji: '🧙', name: 'Sorcerer', team: 'wolf', desc: 'Cari tahu siapa Seer' },
    villager: { emoji: '👨‍🌾', name: 'Villager', team: 'village', desc: 'Diskusi dan vote werewolf' }
}

const WIN_REWARD = { koin: 5000, exp: 1000 }
const MIN_PLAYERS = 4
const MAX_PLAYERS = 15
const PHASE_DURATION = {
    night: 60000,   // 60 seconds
    day: 90000      // 90 seconds
}


function getWWContextInfo(title = '🐺 WEREWOLF', body = 'Social deduction game!', thumbBuffer = thumbWW, mentions) {
    const saluranId = config.saluran?.id || '120363401718869058@newsletter'
    const saluranName = config.saluran?.name || config.bot?.name || 'Ourin-AI'
    
    const contextInfo = {
        forwardingScore: 9999,
        isForwarded: true,
        mentionedJid: mentions,
        forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127
        }
    }
    
    if (thumbBuffer) {
        contextInfo.externalAdReply = {
            title: title,
            body: body,
            thumbnail: thumbBuffer,
            mediaType: 1,
            renderLargerThumbnail: true,
            sourceUrl: config.saluran?.link || ''
        }
    }
    
    return contextInfo
}

// Generate roles based on player count
function generateRoles(playerCount) {
    const roles = []
    
    // Role distribution based on player count (from reference)
    if (playerCount === 4) {
        roles.push('werewolf', 'seer', 'guardian', 'villager')
    } else if (playerCount === 5) {
        roles.push('werewolf', 'seer', 'guardian', 'villager', 'villager')
    } else if (playerCount === 6) {
        roles.push('werewolf', 'werewolf', 'seer', 'guardian', 'villager', 'villager')
    } else if (playerCount === 7) {
        roles.push('werewolf', 'werewolf', 'seer', 'guardian', 'villager', 'villager', 'villager')
    } else if (playerCount === 8) {
        roles.push('werewolf', 'werewolf', 'seer', 'guardian', 'villager', 'villager', 'villager', 'villager')
    } else if (playerCount === 9) {
        roles.push('werewolf', 'werewolf', 'seer', 'guardian', 'sorcerer', 'villager', 'villager', 'villager', 'villager')
    } else if (playerCount === 10) {
        roles.push('werewolf', 'werewolf', 'seer', 'guardian', 'sorcerer', 'villager', 'villager', 'villager', 'villager', 'villager')
    } else if (playerCount === 11) {
        roles.push('werewolf', 'werewolf', 'seer', 'guardian', 'guardian', 'sorcerer', 'villager', 'villager', 'villager', 'villager', 'villager')
    } else if (playerCount >= 12) {
        roles.push('werewolf', 'werewolf', 'seer', 'guardian', 'guardian', 'sorcerer')
        while (roles.length < playerCount) roles.push('villager')
    }
    
    // Shuffle roles
    for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]]
    }
    
    return roles
}

// Get role description for PM
function getRoleDescription(role, prefix = '.') {
    const descriptions = {
        werewolf: `🐺 *WEREWOLF*\n\n` +
            `Kamu adalah predator malam!\n\n` +
            `╭┈┈⬡「 📋 *INFO* 」\n` +
            `┃ 🎯 Tujuan: Bunuh semua Villager\n` +
            `┃ ⚔️ Skill: Bunuh 1 player tiap malam\n` +
            `┃ 🕐 Aksi: Malam hari\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Di malam hari, ketik:\n` +
            `> \`${prefix}wwkill <nomor>\` di PM bot`,
        seer: `🔮 *SEER*\n\n` +
            `Kamu bisa melihat identitas player!\n\n` +
            `╭┈┈⬡「 📋 *INFO* 」\n` +
            `┃ 🎯 Tujuan: Bantu Villager\n` +
            `┃ 🔮 Skill: Lihat role 1 player\n` +
            `┃ 🕐 Aksi: Malam hari\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Di malam hari, ketik:\n` +
            `> \`${prefix}wwsee <nomor>\` di PM bot`,
        guardian: `🛡️ *GUARDIAN*\n\n` +
            `Kamu bisa melindungi player!\n\n` +
            `╭┈┈⬡「 📋 *INFO* 」\n` +
            `┃ 🎯 Tujuan: Lindungi Villager\n` +
            `┃ 🛡️ Skill: Lindungi 1 player\n` +
            `┃ 🕐 Aksi: Malam hari\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Di malam hari, ketik:\n` +
            `> \`${prefix}wwprotect <nomor>\` di PM bot`,
        sorcerer: `🧙 *SORCERER*\n\n` +
            `Kamu sekutu Werewolf!\n\n` +
            `╭┈┈⬡「 📋 *INFO* 」\n` +
            `┃ 🎯 Tujuan: Bantu Werewolf menang\n` +
            `┃ 🔍 Skill: Cek apakah target adalah Seer\n` +
            `┃ 🕐 Aksi: Malam hari\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Di malam hari, ketik:\n` +
            `> \`${prefix}wwsorcerer <nomor>\` di PM bot`,
        villager: `👨‍🌾 *VILLAGER*\n\n` +
            `Kamu warga biasa!\n\n` +
            `╭┈┈⬡「 📋 *INFO* 」\n` +
            `┃ 🎯 Tujuan: Temukan Werewolf\n` +
            `┃ 🗳️ Skill: Vote di siang hari\n` +
            `┃ 🕐 Aksi: Siang hari\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Diskusi dan vote werewolf!\n` +
            `> \`${prefix}ww vote <nomor>\` di grup`
    }
    return descriptions[role] || 'Unknown Role'
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const args = m.args || []
    const action = args[0]?.toLowerCase()
    const target = args[1]
    const ww = global.werewolfGames
    const prefix = m.prefix || config.command?.prefix || '.'
    
    const commands = {
        create: async () => {
            if (ww[m.chat]) {
                const game = ww[m.chat]
                if (game.status === 'waiting') {
                    return sock.sendMessage(m.chat, {
                        text: `❌ *ROOM SUDAH ADA*\n\n` +
                            `> Room masih menunggu player\n` +
                            `> Ketik \`${prefix}ww join\` untuk gabung\n` +
                            `> Host: @${game.owner.split('@')[0]}`,
                        mentions: [game.owner],
                        contextInfo: getWWContextInfo()
                    }, { quoted: m })
                }
                return m.reply(`❌ Game sedang berlangsung! Tunggu sampai selesai.`)
            }
            
            // Check if player already in another room
            const existingRoom = Object.entries(ww).find(
                ([chatId, room]) => room.players.some(p => p.id === m.sender)
            )
            if (existingRoom) {
                return m.reply(`❌ Kamu masih dalam game di grup lain!`)
            }
            
            // Create new game room
            ww[m.chat] = {
                room: m.chat,
                owner: m.sender,
                status: 'waiting',
                day: 0,
                phase: 'lobby',
                players: [{
                    id: m.sender,
                    number: 1,
                    role: null,
                    alive: true,
                    voted: false,
                    skillUsed: false
                }],
                dead: [],
                votes: {},
                nightActions: {
                    kill: null,
                    protect: null,
                    see: null,
                    sorcerer: null
                },
                createdAt: Date.now(),
                timeout: null
            }
            
            await m.react('🐺')
            await sock.sendMessage(m.chat, {
                text: `🐺 *WEREWOLF GAME*\n\n` +
                    `Room berhasil dibuat!\n\n` +
                    `╭┈┈⬡「 📋 *INFO ROOM* 」\n` +
                    `┃ 👑 Host: @${m.sender.split('@')[0]}\n` +
                    `┃ 👥 Player: 1/${MAX_PLAYERS}\n` +
                    `┃ ⏱️ Min: ${MIN_PLAYERS} player\n` +
                    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                    `╭┈┈⬡「 🎮 *CARA MAIN* 」\n` +
                    `┃ ➕ \`${prefix}ww join\` - Gabung\n` +
                    `┃ ▶️ \`${prefix}ww start\` - Mulai (host)\n` +
                    `┃ 👥 \`${prefix}ww player\` - List player\n` +
                    `┃ 🚪 \`${prefix}ww exit\` - Keluar\n` +
                    `╰┈┈┈┈┈┈┈┈⬡`,
                mentions: [m.sender],
                contextInfo: getWWContextInfo('🐺 WEREWOLF', 'Room Created!')
            }, { quoted: m })
        },
        
        join: async () => {
            if (!ww[m.chat]) {
                return m.reply(`❌ Belum ada room!\n> Ketik \`${prefix}ww create\` untuk buat room`)
            }
            
            if (ww[m.chat].status !== 'waiting') {
                return m.reply(`❌ Game sudah dimulai! Tunggu ronde berikutnya.`)
            }
            
            if (ww[m.chat].players.length >= MAX_PLAYERS) {
                return m.reply(`❌ Room penuh! (Max ${MAX_PLAYERS} player)`)
            }
            
            if (ww[m.chat].players.some(p => p.id === m.sender)) {
                return m.reply(`❌ Kamu sudah bergabung!`)
            }
            
            const existingRoom = Object.entries(ww).find(
                ([chatId, room]) => chatId !== m.chat && room.players.some(p => p.id === m.sender)
            )
            if (existingRoom) {
                return m.reply(`❌ Kamu masih dalam game di grup lain!`)
            }
            
            ww[m.chat].players.push({
                id: m.sender,
                number: ww[m.chat].players.length + 1,
                role: null,
                alive: true,
                voted: false,
                skillUsed: false
            })
            
            const playerList = ww[m.chat].players.map((p, i) => 
                `${i + 1}. @${p.id.split('@')[0]}`
            ).join('\n')
            
            const canStart = ww[m.chat].players.length >= MIN_PLAYERS
            
            await m.react('✅')
            await sock.sendMessage(m.chat, {
                text: `✅ *PLAYER BERGABUNG*\n\n` +
                    `@${m.sender.split('@')[0]} masuk!\n\n` +
                    `╭┈┈⬡「 👥 *PLAYER LIST* 」\n` +
                    `${playerList.split('\n').map(l => `┃ ${l}`).join('\n')}\n` +
                    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                    `> Total: ${ww[m.chat].players.length}/${MIN_PLAYERS} (min)\n` +
                    (canStart ? `> ✅ Bisa mulai! \`${prefix}ww start\`` : `> ⏳ Butuh ${MIN_PLAYERS - ww[m.chat].players.length} player lagi`),
                contextInfo: getWWContextInfo('🐺 WEREWOLF', `${ww[m.chat].players.length} players`, null, ww[m.chat].players.map(p => p.id))
            }, { quoted: m })
        },
        
        start: async () => {
            if (!ww[m.chat]) {
                return m.reply(`❌ Belum ada room!`)
            }
            
            if (ww[m.chat].status !== 'waiting') {
                return m.reply(`❌ Game sudah berjalan!`)
            }
            
            if (ww[m.chat].owner !== m.sender && !config.isOwner?.(m.sender)) {
                return m.reply(`❌ Hanya host yang dapat memulai game!`)
            }
            
            if (ww[m.chat].players.length < MIN_PLAYERS) {
                return m.reply(`❌ Minimal ${MIN_PLAYERS} player!\n> Saat ini: ${ww[m.chat].players.length} player`)
            }
            
            // Generate and assign roles
            const roles = generateRoles(ww[m.chat].players.length)
            ww[m.chat].players.forEach((p, i) => {
                p.role = roles[i]
            })
            
            ww[m.chat].status = 'playing'
            ww[m.chat].day = 1
            ww[m.chat].phase = 'night'
            
            // Send role to each player via PM
            for (const player of ww[m.chat].players) {
                try {
                    await sock.sendMessage(player.id, {
                        text: getRoleDescription(player.role, prefix),
                        contextInfo: getWWContextInfo(
                            `${ROLES[player.role].emoji} ${ROLES[player.role].name}`, 
                            'Role kamu!'
                        )
                    })
                } catch (e) {
                    console.log(`[WW] Failed to send role to ${player.id}:`, e.message)
                }
            }
            
            // Build player list
            const playerList = ww[m.chat].players.map((p, i) => 
                `${i + 1}. @${p.id.split('@')[0]}`
            ).join('\n')
            
            // Count roles
            const roleCount = {}
            ww[m.chat].players.forEach(p => {
                roleCount[p.role] = (roleCount[p.role] || 0) + 1
            })
            const roleInfo = Object.entries(roleCount).map(([role, count]) => 
                `${ROLES[role].emoji} ${ROLES[role].name}: ${count}`
            ).join('\n')
            
            await m.react('🌙')
            await sock.sendMessage(m.chat, {
                text: `🐺 *GAME DIMULAI!*\n\n` +
                    `🌙 *Malam Hari ke-1*\n\n` +
                    `╭┈┈⬡「 👥 *PLAYERS* 」\n` +
                    `${playerList.split('\n').map(l => `┃ ${l}`).join('\n')}\n` +
                    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                    `╭┈┈⬡「 🎭 *ROLES* 」\n` +
                    `${roleInfo.split('\n').map(l => `┃ ${l}`).join('\n')}\n` +
                    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                    `> 📩 Cek PM untuk role kalian!\n` +
                    `> 🌙 Werewolf berburu...\n` +
                    `> ⏱️ Waktu malam: ${PHASE_DURATION.night / 1000} detik`,
                mentions: ww[m.chat].players.map(p => p.id),
                contextInfo: getWWContextInfo('🌙 NIGHT', 'Werewolf berburu...', thumbNight, ww[m.chat].players.map(p => p.id))
            }, { quoted: m })
            
            // Send night skill prompts to special roles
            await sendNightPrompts(m.chat, sock, prefix)
            
            // Set timeout for night phase
            ww[m.chat].timeout = setTimeout(() => {
                processNightActions(m.chat, sock, db, prefix)
            }, PHASE_DURATION.night)
        },
        
        vote: async () => {
            if (!ww[m.chat] || ww[m.chat].status !== 'playing') {
                return m.reply(`❌ Tidak ada game aktif!`)
            }
            
            if (ww[m.chat].phase !== 'day') {
                return m.reply(`❌ Sekarang bukan waktu voting!\n> Phase: ${ww[m.chat].phase === 'night' ? '🌙 Malam' : ww[m.chat].phase}`)
            }
            
            const player = ww[m.chat].players.find(p => p.id === m.sender)
            if (!player) {
                return m.reply(`❌ Kamu bukan player dalam game ini!`)
            }
            
            if (!player.alive) {
                return m.reply(`❌ Kamu sudah mati! Tidak bisa vote.`)
            }
            
            if (player.voted) {
                return m.reply(`❌ Kamu sudah vote! Tunggu hasil voting.`)
            }
            
            if (!target) {
                const alivePlayers = ww[m.chat].players.filter(p => p.alive)
                const list = alivePlayers.map(p => 
                    `${p.number}. @${p.id.split('@')[0]}`
                ).join('\n')
                return sock.sendMessage(m.chat, {
                    text: `🗳️ *VOTING*\n\n` +
                        `Pilih siapa yang ingin dieliminasi:\n\n` +
                        `${list}\n\n` +
                        `> Ketik: \`${prefix}ww vote <nomor>\``,
                    mentions: alivePlayers.map(p => p.id),
                    contextInfo: getWWContextInfo('🗳️ VOTING', 'Pilih target!')
                }, { quoted: m })
            }
            
            const targetNum = parseInt(target)
            if (isNaN(targetNum)) {
                return m.reply(`❌ Masukkan nomor player! Contoh: \`${prefix}ww vote 2\``)
            }
            
            const targetPlayer = ww[m.chat].players.find(p => p.number === targetNum)
            if (!targetPlayer) {
                return m.reply(`❌ Player nomor ${targetNum} tidak ditemukan!`)
            }
            
            if (!targetPlayer.alive) {
                return m.reply(`❌ Player tersebut sudah mati!`)
            }
            
            player.voted = true
            ww[m.chat].votes[targetPlayer.id] = (ww[m.chat].votes[targetPlayer.id] || 0) + 1
            
            const alivePlayers = ww[m.chat].players.filter(p => p.alive)
            const votedCount = alivePlayers.filter(p => p.voted).length
            
            await m.react('🗳️')
            await sock.sendMessage(m.chat, {
                text: `🗳️ *VOTE TERCATAT*\n\n` +
                    `@${m.sender.split('@')[0]} ➜ @${targetPlayer.id.split('@')[0]}\n\n` +
                    `> Progress: ${votedCount}/${alivePlayers.length}`,
                mentions: [m.sender, targetPlayer.id],
                contextInfo: getWWContextInfo('🗳️ VOTE', `${votedCount}/${alivePlayers.length}`)
            }, { quoted: m })
            
            // Check if all votes are in
            if (votedCount >= alivePlayers.length) {
                if (ww[m.chat].timeout) clearTimeout(ww[m.chat].timeout)
                await executeVote(m.chat, sock, db, prefix)
            }
        },
        
        player: async () => {
            if (!ww[m.chat]) {
                return m.reply(`❌ Tidak ada game di room ini!`)
            }
            
            const playerList = ww[m.chat].players.map((p, i) => {
                const status = p.alive ? '✅' : `☠️ (${ROLES[p.role]?.name || 'Unknown'})`
                return `${p.number}. @${p.id.split('@')[0]} ${status}`
            }).join('\n')
            
            const phaseEmoji = ww[m.chat].phase === 'night' ? '🌙' : ww[m.chat].phase === 'day' ? '☀️' : '⏳'
            
            await sock.sendMessage(m.chat, {
                text: `🐺 *WEREWOLF - STATUS*\n\n` +
                    `╭┈┈⬡「 📊 *GAME INFO* 」\n` +
                    `┃ 📅 Day: ${ww[m.chat].day}\n` +
                    `┃ ${phaseEmoji} Phase: ${ww[m.chat].phase}\n` +
                    `┃ 👤 Alive: ${ww[m.chat].players.filter(p => p.alive).length}\n` +
                    `┃ ☠️ Dead: ${ww[m.chat].dead.length}\n` +
                    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                    `╭┈┈⬡「 👥 *PLAYERS* 」\n` +
                    `${playerList.split('\n').map(l => `┃ ${l}`).join('\n')}\n` +
                    `╰┈┈┈┈┈┈┈┈⬡`,
                mentions: ww[m.chat].players.map(p => p.id),
                contextInfo: getWWContextInfo('🐺 WEREWOLF', `Day ${ww[m.chat].day}`)
            }, { quoted: m })
        },
        
        exit: async () => {
            if (!ww[m.chat]) {
                return m.reply(`❌ Tidak ada game di room ini!`)
            }
            
            const playerIdx = ww[m.chat].players.findIndex(p => p.id === m.sender)
            if (playerIdx === -1) {
                return m.reply(`❌ Kamu tidak ada di game ini!`)
            }
            
            if (ww[m.chat].status === 'playing') {
                return m.reply(`❌ Tidak bisa keluar saat game berjalan!`)
            }
            
            ww[m.chat].players.splice(playerIdx, 1)
            ww[m.chat].players.forEach((p, i) => p.number = i + 1)
            
            if (ww[m.chat].players.length === 0) {
                if (ww[m.chat].timeout) clearTimeout(ww[m.chat].timeout)
                delete ww[m.chat]
                return m.reply(`🗑️ Room dihapus karena kosong.`)
            }
            
            // Transfer host if owner left
            if (ww[m.chat].owner === m.sender && ww[m.chat].players.length > 0) {
                ww[m.chat].owner = ww[m.chat].players[0].id
                await sock.sendMessage(m.chat, {
                    text: `👋 @${m.sender.split('@')[0]} keluar.\n` +
                        `👑 Host baru: @${ww[m.chat].owner.split('@')[0]}`,
                    mentions: [m.sender, ww[m.chat].owner],
                    contextInfo: getWWContextInfo()
                }, { quoted: m })
            } else {
                await sock.sendMessage(m.chat, {
                    text: `👋 @${m.sender.split('@')[0]} keluar dari game.`,
                    mentions: [m.sender],
                    contextInfo: getWWContextInfo()
                }, { quoted: m })
            }
        },
        
        delete: async () => {
            if (!ww[m.chat]) {
                return m.reply(`❌ Tidak ada game di room ini!`)
            }
            
            const isOwner = ww[m.chat].owner === m.sender
            const isBotOwner = config.isOwner?.(m.sender)
            
            if (!isOwner && !isBotOwner) {
                return m.reply(`❌ Hanya host atau owner bot yang dapat menghapus!`)
            }
            
            if (ww[m.chat].timeout) clearTimeout(ww[m.chat].timeout)
            delete ww[m.chat]
            
            await m.react('🗑️')
            await m.reply(`🗑️ Game dihapus!`)
        }
    }
    
    // Show help if no action
    if (!action || !commands[action]) {
        return sock.sendMessage(m.chat, {
            text: `🐺 *WEREWOLF GAME*\n\n` +
                `Permainan sosial mencari Werewolf!\n\n` +
                `╭┈┈⬡「 🎮 *COMMANDS* 」\n` +
                `┃ 🆕 \`${prefix}ww create\` - Buat room\n` +
                `┃ ➕ \`${prefix}ww join\` - Gabung\n` +
                `┃ ▶️ \`${prefix}ww start\` - Mulai (host)\n` +
                `┃ 🗳️ \`${prefix}ww vote <no>\` - Vote\n` +
                `┃ 👥 \`${prefix}ww player\` - List player\n` +
                `┃ 🚪 \`${prefix}ww exit\` - Keluar\n` +
                `┃ 🗑️ \`${prefix}ww delete\` - Hapus room\n` +
                `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                `╭┈┈⬡「 🎭 *ROLES* 」\n` +
                `┃ 🐺 Werewolf - Bunuh warga\n` +
                `┃ 🧙 Sorcerer - Cari Seer\n` +
                `┃ 🔮 Seer - Lihat role\n` +
                `┃ 🛡️ Guardian - Lindungi\n` +
                `┃ 👨‍🌾 Villager - Vote werewolf\n` +
                `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                `> Min: ${MIN_PLAYERS} players | Max: ${MAX_PLAYERS} players`,
            contextInfo: getWWContextInfo('🐺 WEREWOLF', 'Social deduction game!')
        }, { quoted: m })
    }
    
    try {
        await commands[action]()
    } catch (error) {
        console.error('[WEREWOLF ERROR]', error)
        await m.reply(`❌ Terjadi error: ${error.message}`)
    }
}

// Send night skill prompts to players
async function sendNightPrompts(chatId, sock, prefix) {
    const ww = global.werewolfGames
    if (!ww[chatId]) return
    
    const game = ww[chatId]
    const alivePlayers = game.players.filter(p => p.alive)
    
    // Build player list for prompts
    let playerListNormal = ''
    let playerListWolf = ''
    
    alivePlayers.forEach(p => {
        playerListNormal += `(${p.number}) @${p.id.split('@')[0]}\n`
        const roleTag = (p.role === 'werewolf' || p.role === 'sorcerer') ? ` [${ROLES[p.role].name}]` : ''
        playerListWolf += `(${p.number}) @${p.id.split('@')[0]}${roleTag}\n`
    })
    
    const mentions = alivePlayers.map(p => p.id)
    
    // Send prompts based on role
    for (const player of alivePlayers) {
        try {
            let text = ''
            
            switch (player.role) {
                case 'werewolf':
                    text = `🐺 *MALAM HARI*\n\n` +
                        `Saatnya berburu! Pilih target:\n\n` +
                        `${playerListWolf}\n` +
                        `> Ketik \`${prefix}wwkill <nomor>\` untuk membunuh`
                    break
                case 'seer':
                    text = `🔮 *MALAM HARI*\n\n` +
                        `Siapa yang ingin kamu lihat rolenya?\n\n` +
                        `${playerListNormal}\n` +
                        `> Ketik \`${prefix}wwsee <nomor>\` untuk melihat role`
                    break
                case 'guardian':
                    text = `🛡️ *MALAM HARI*\n\n` +
                        `Siapa yang ingin kamu lindungi?\n\n` +
                        `${playerListNormal}\n` +
                        `> Ketik \`${prefix}wwprotect <nomor>\` untuk melindungi`
                    break
                case 'sorcerer':
                    text = `🧙 *MALAM HARI*\n\n` +
                        `Cari tahu siapa Seer!\n\n` +
                        `${playerListWolf}\n` +
                        `> Ketik \`${prefix}wwsorcerer <nomor>\` untuk mengecek`
                    break
                case 'villager':
                    text = `👨‍🌾 *MALAM HARI*\n\n` +
                        `Sebagai warga, berhati-hatilah.\n` +
                        `Mungkin kamu adalah target selanjutnya.\n\n` +
                        `${playerListNormal}`
                    break
            }
            
            if (text) {
                await sock.sendMessage(player.id, {
                    text,
                    mentions,
                    contextInfo: getWWContextInfo('🌙 NIGHT', 'Gunakan skillmu!', thumbNight, mentions)
                })
            }
        } catch (e) {
            console.log(`[WW] Failed to send prompt to ${player.id}:`, e.message)
        }
    }
}

// Process night actions
async function processNightActions(chatId, sock, db, prefix) {
    const ww = global.werewolfGames
    if (!ww[chatId] || ww[chatId].phase !== 'night') return
    
    let killTarget = ww[chatId].nightActions.kill
    const protectTarget = ww[chatId].nightActions.protect
    
    let nightReport = `☀️ *PAGI HARI KE-${ww[chatId].day}*\n\n`
    
    // Process kill if not protected
    if (killTarget && killTarget !== protectTarget) {
        const victim = ww[chatId].players.find(p => p.id === killTarget)
        if (victim && victim.alive) {
            victim.alive = false
            ww[chatId].dead.push(victim)
            nightReport += `☠️ @${victim.id.split('@')[0]} ditemukan tewas!\n`
            nightReport += `> Role: ${ROLES[victim.role].emoji} ${ROLES[victim.role].name}\n\n`
        }
    } else if (killTarget && killTarget === protectTarget) {
        nightReport += `🛡️ Guardian berhasil melindungi target!\n`
        nightReport += `> Tidak ada korban malam ini.\n\n`
    } else {
        nightReport += `🌅 Malam yang tenang...\n`
        nightReport += `> Tidak ada korban.\n\n`
    }
    
    // Check win condition
    const winner = checkWinner(chatId)
    if (winner) {
        await sock.sendMessage(chatId, {
            text: nightReport,
            mentions: ww[chatId].players.map(p => p.id),
            contextInfo: getWWContextInfo('☀️ DAY', 'Pagi telah tiba...', thumbDay, ww[chatId].players.map(p => p.id))
        })
        await endGame(chatId, sock, db, winner)
        return
    }
    
    // Change phase to day
    ww[chatId].phase = 'day'
    ww[chatId].votes = {}
    ww[chatId].nightActions = { kill: null, protect: null, see: null, sorcerer: null }
    ww[chatId].players.forEach(p => {
        p.voted = false
        p.skillUsed = false
    })
    
    const alivePlayers = ww[chatId].players.filter(p => p.alive)
    const playerList = alivePlayers.map(p => 
        `${p.number}. @${p.id.split('@')[0]}`
    ).join('\n')
    
    nightReport += `╭┈┈⬡「 👥 *PLAYER HIDUP* 」\n`
    nightReport += `${playerList.split('\n').map(l => `┃ ${l}`).join('\n')}\n`
    nightReport += `╰┈┈┈┈┈┈┈┈⬡\n\n`
    nightReport += `> 🗳️ Waktunya voting!\n`
    nightReport += `> Ketik \`${prefix}ww vote <nomor>\`\n`
    nightReport += `> ⏱️ Waktu: ${PHASE_DURATION.day / 1000} detik`
    
    await sock.sendMessage(chatId, {
        text: nightReport,
        mentions: ww[chatId].players.map(p => p.id),
        contextInfo: getWWContextInfo('☀️ DAY', 'Voting time!', thumbDay, ww[chatId].players.map(p => p.id))
    })
    
    ww[chatId].timeout = setTimeout(() => {
        executeVote(chatId, sock, db, prefix)
    }, PHASE_DURATION.day)
}

// Execute vote results
async function executeVote(chatId, sock, db, prefix) {
    const ww = global.werewolfGames
    if (!ww[chatId] || ww[chatId].phase !== 'day') return
    
    let maxVotes = 0
    let eliminated = null
    let isTie = false
    
    for (const [playerId, votes] of Object.entries(ww[chatId].votes)) {
        if (votes > maxVotes) {
            maxVotes = votes
            eliminated = playerId
            isTie = false
        } else if (votes === maxVotes && maxVotes > 0) {
            isTie = true
        }
    }
    
    let resultText = `⚖️ *HASIL VOTING*\n\n`
    
    if (isTie || maxVotes === 0) {
        resultText += `🤷 Tidak ada yang tereliminasi!\n`
        resultText += `> ${isTie ? 'Vote seri!' : 'Tidak ada yang vote.'}\n\n`
    } else if (eliminated) {
        const player = ww[chatId].players.find(p => p.id === eliminated)
        if (player) {
            player.alive = false
            ww[chatId].dead.push(player)
            
            resultText += `⚰️ @${eliminated.split('@')[0]} dieliminasi!\n`
            resultText += `> Role: ${ROLES[player.role].emoji} ${ROLES[player.role].name}\n`
            resultText += `> Votes: ${maxVotes}\n\n`
        }
    }
    
    // Check win condition
    const winner = checkWinner(chatId)
    if (winner) {
        await sock.sendMessage(chatId, {
            text: resultText,
            mentions: eliminated ? [eliminated] : [],
            contextInfo: getWWContextInfo('⚖️ VOTING', 'Hasil voting', thumbDay)
        })
        await endGame(chatId, sock, db, winner)
        return
    }
    
    // Change to night phase
    ww[chatId].phase = 'night'
    ww[chatId].day++
    ww[chatId].nightActions = { kill: null, protect: null, see: null, sorcerer: null }
    ww[chatId].players.forEach(p => {
        p.voted = false
        p.skillUsed = false
    })
    
    resultText += `🌙 *MALAM HARI KE-${ww[chatId].day}*\n\n`
    resultText += `> Werewolf berburu...\n`
    resultText += `> Special roles, gunakan skill kalian di PM!\n`
    resultText += `> ⏱️ Waktu: ${PHASE_DURATION.night / 1000} detik`
    
    await sock.sendMessage(chatId, {
        text: resultText,
        mentions: eliminated ? [eliminated] : [],
        contextInfo: getWWContextInfo('🌙 NIGHT', 'Werewolf berburu...', thumbNight)
    })
    
    // Send night prompts
    await sendNightPrompts(chatId, sock, prefix)
    
    ww[chatId].timeout = setTimeout(() => {
        processNightActions(chatId, sock, db, prefix)
    }, PHASE_DURATION.night)
}

// Check win condition
function checkWinner(chatId) {
    const ww = global.werewolfGames
    if (!ww[chatId]) return null
    
    const alivePlayers = ww[chatId].players.filter(p => p.alive)
    const wolves = alivePlayers.filter(p => ROLES[p.role]?.team === 'wolf')
    const villagers = alivePlayers.filter(p => ROLES[p.role]?.team === 'village')
    
    if (wolves.length === 0) return 'village'
    if (wolves.length >= villagers.length) return 'wolf'
    
    return null
}

// End game and give rewards
async function endGame(chatId, sock, db, winner) {
    const ww = global.werewolfGames
    if (!ww[chatId]) return
    
    if (ww[chatId].timeout) clearTimeout(ww[chatId].timeout)
    
    const winningTeam = winner === 'wolf' ? 'wolf' : 'village'
    const winningPlayers = ww[chatId].players.filter(p => 
        ROLES[p.role]?.team === winningTeam
    )
    
    // Give rewards to winners
    for (const player of winningPlayers) {
        try {
            db.updateKoin(player.id, WIN_REWARD.koin)
            const user = db.getUser(player.id)
            if (user) {
                user.exp = (user.exp || 0) + WIN_REWARD.exp
                db.setUser(player.id, user)
            }
        } catch (e) {
            console.log(`[WW] Failed to give reward to ${player.id}:`, e.message)
        }
    }
    
    const allPlayers = ww[chatId].players.map(p => {
        const status = p.alive ? '✅' : '☠️'
        const isWinner = winningPlayers.some(w => w.id === p.id) ? '🏆' : ''
        return `${status} @${p.id.split('@')[0]} - ${ROLES[p.role].emoji} ${ROLES[p.role].name} ${isWinner}`
    }).join('\n')
    
    await sock.sendMessage(chatId, {
        text: `🎉 *GAME OVER!*\n\n` +
            `${winner === 'wolf' ? '🐺 *WEREWOLF MENANG!*' : '👨‍🌾 *VILLAGER MENANG!*'}\n\n` +
            `╭┈┈⬡「 👥 *SEMUA PLAYER* 」\n` +
            `${allPlayers.split('\n').map(l => `┃ ${l}`).join('\n')}\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `╭┈┈⬡「 🎁 *HADIAH* 」\n` +
            `┃ 💰 +${WIN_REWARD.koin.toLocaleString()} Koin\n` +
            `┃ ⭐ +${WIN_REWARD.exp.toLocaleString()} EXP\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> GG WP! Main lagi? \`${config.command?.prefix || '.'}ww create\``,
        mentions: ww[chatId].players.map(p => p.id),
        contextInfo: getWWContextInfo(
            '🏆 GAME OVER', 
            `${winner === 'wolf' ? 'Werewolf' : 'Villager'} wins!`,
            thumbWin
        )
    })
    
    delete ww[chatId]
}

// Night action handler for PM commands
async function nightActionHandler(m, { sock }) {
    const db = getDatabase()
    const ww = global.werewolfGames
    const prefix = m.prefix || config.command?.prefix || '.'
    
    // Find the game this player is in
    const chatId = Object.keys(ww).find(id => 
        ww[id].players.some(p => p.id === m.sender && p.alive) &&
        ww[id].phase === 'night'
    )
    
    if (!chatId) {
        return m.reply(`❌ Kamu tidak sedang dalam game werewolf atau bukan fase malam!`)
    }
    
    const game = ww[chatId]
    const player = game.players.find(p => p.id === m.sender)
    if (!player || !player.alive) {
        return m.reply(`❌ Kamu sudah mati atau bukan player!`)
    }
    
    // Check if skill already used
    if (player.skillUsed) {
        return m.reply(`❌ Kamu sudah menggunakan skill malam ini!`)
    }
    
    const cmd = m.command?.toLowerCase()
    const targetNum = parseInt(m.args?.[0])
    
    if (isNaN(targetNum)) {
        return m.reply(`❌ Masukkan nomor target! Contoh: \`${prefix}${cmd} 2\``)
    }
    
    const targetPlayer = game.players.find(p => p.number === targetNum && p.alive)
    if (!targetPlayer) {
        return m.reply(`❌ Target tidak valid atau sudah mati!`)
    }
    
    // Process based on command and role
    if (cmd === 'wwkill' && player.role === 'werewolf') {
        if (targetPlayer.role === 'werewolf' || targetPlayer.role === 'sorcerer') {
            return m.reply(`❌ Tidak bisa membunuh sesama team!`)
        }
        game.nightActions.kill = targetPlayer.id
        player.skillUsed = true
        await m.reply(
            `🐺 *TARGET TERPILIH*\n\n` +
            `Target: @${targetPlayer.id.split('@')[0]}\n` +
            `> Menunggu malam berakhir...`,
            { mentions: [targetPlayer.id] }
        )
        return true
    }
    
    if (cmd === 'wwprotect' && player.role === 'guardian') {
        game.nightActions.protect = targetPlayer.id
        player.skillUsed = true
        await m.reply(
            `🛡️ *TARGET DILINDUNGI*\n\n` +
            `Melindungi: @${targetPlayer.id.split('@')[0]}\n` +
            `> Menunggu malam berakhir...`,
            { mentions: [targetPlayer.id] }
        )
        return true
    }
    
    if (cmd === 'wwsee' && player.role === 'seer') {
        const roleInfo = ROLES[targetPlayer.role]
        player.skillUsed = true
        await m.reply(
            `🔮 *HASIL PENGLIHATAN*\n\n` +
            `@${targetPlayer.id.split('@')[0]} adalah:\n` +
            `${roleInfo.emoji} *${roleInfo.name}*\n\n` +
            `> Team: ${roleInfo.team === 'wolf' ? '🐺 Wolf' : '👨‍🌾 Village'}`,
            { mentions: [targetPlayer.id] }
        )
        return true
    }
    
    if (cmd === 'wwsorcerer' && player.role === 'sorcerer') {
        const isSeer = targetPlayer.role === 'seer'
        player.skillUsed = true
        await m.reply(
            `🧙 *HASIL INVESTIGASI*\n\n` +
            `@${targetPlayer.id.split('@')[0]}\n` +
            `${isSeer ? '✅ *adalah SEER!*' : '❌ *bukan Seer*'}\n\n` +
            `> Lanjutkan membantu Werewolf!`,
            { mentions: [targetPlayer.id] }
        )
        return true
    }
    
    // Wrong role for command
    return m.reply(`❌ Kamu tidak memiliki kemampuan ini!\n> Role kamu: ${ROLES[player.role]?.name || 'Unknown'}`)
}

module.exports = {
    config: pluginConfig,
    handler,
    nightActionHandler,
    ROLES,   // Export for other plugins
    getWWContextInfo  // Export for other plugins
}
