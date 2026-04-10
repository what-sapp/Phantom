const cron = require('node-cron');
const config = require('../../config');
const { getDatabase } = require('../../src/lib/database');

const pluginConfig = {
    name: 'autosahur',
    alias: ['sahur'],
    category: 'religi',
    description: 'Automatic pre-dawn meal reminder (Every 03:00 AM)',
    usage: '.autosahur on/off',
    example: '.autosahur on',
    isGroup: true,
    isBotAdmin: false,
    isAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

const AUDIO_SAHUR = 'https://raw.githubusercontent.com/AhmadAkbarID/media/refs/heads/main/sahur.mp3';
let sahurTask = null;

function initSahurCron(sock) {
    if (sahurTask) sahurTask.stop();
    sahurTask = cron.schedule('00 03 * * *', async () => {
        const db = getDatabase();
        if (!db) return;

        try {
            const groupsObj = await sock.groupFetchAllParticipating();
            const groupList = Object.keys(groupsObj);
            
            for (const jid of groupList) {
                const groupData = db.getGroup(jid) || {};
                
                if (groupData.autoSahur === true) {
                    try {
                        await sock.sendMessage(jid, {
                            audio: { url: AUDIO_SAHUR },
                            mimetype: 'audio/mpeg',
                            ptt: true,
                            contextInfo: {
                                isForwarded: true,
                                forwardingScore: 777,
                                externalAdReply: {
                                    title: '🌙 PRE-DAWN MEAL TIME!',
                                    body: 'Time for pre-dawn meal, friends! 🥘',
                                    thumbnailUrl: 'https://cdn.gimita.id/download/sahur-ilustrasi-qazwa_1771141170617_2377330d.jpg',
                                    sourceUrl: config.saluran?.link || '',
                                    mediaType: 1,
                                    renderLargerThumbnail: true
                                }
                            }
                        });
                        await new Promise(res => setTimeout(res, 2000));
                    } catch (e) {
                         console.log(`[AutoSahur] Failed to send to ${jid}:`, e.message);
                    }
                }
            }
        } catch (e) {
            console.error('[AutoSahur] Cron Job Error:', e);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });
    
    console.log('[AutoSahur] Cron job initialized (03:00 WIB)');
}

async function handler(m, { sock, db }) {
    if (!m.isGroup) return m.reply(config.messages.groupOnly);
    if (!m.isAdmin && !m.isOwner) return m.reply(config.messages.adminOnly);

    const args = m.args[0]?.toLowerCase();

    if (args === 'on') {
        db.setGroup(m.chat, { autoSahur: true });
        m.reply('✅ *Auto Pre-dawn Meal Reminder Activated!*\n\n> Bot will send reminders in this group every 03:00 AM WIB.');
    } else if (args === 'off') {
        db.setGroup(m.chat, { autoSahur: false });
        m.reply('❌ *Auto Pre-dawn Meal Reminder Deactivated in this group!*');
    } else {
        m.reply(`*AUTO PRE-DAWN MEAL REMINDER*
            
⚠️ Usage: \`${m.prefix}autosahur on/off\``);
    }
}

module.exports = {
    config: pluginConfig,
    handler,
    initSahurCron
};