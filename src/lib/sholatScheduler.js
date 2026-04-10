const { getDatabase } = require('./database');
const { logger } = require('./colors');
const config = require('../../config');
const { getTodaySchedule, extractPrayerTimes } = require('./sholatAPI');

const SHOLAT_MESSAGES = {
    imsak: '🌙 *IMSAK TIME*\n\n> Dear friend, Imsak time has arrived.\n> Eat your suhoor before time runs out.',
    subuh: '🌅 *FAJR TIME*\n\n> Dear friend, Fajr prayer time has arrived.\n> Take your wudu and pray immediately.',
    sunrise: '☀️ *SUNRISE TIME*\n\n> The sun has risen.\n> Have a great day ahead!',
    dhuha: '🌤️ *DHUHA TIME*\n\n> Dear friend, Dhuha prayer time has arrived.\n> Don\'t forget to pray Dhuha 2-8 rakats.',
    dzuhur: '🌞 *DZUHUR TIME*\n\n> Dear friend, Dzuhur prayer time has arrived.\n> Take your wudu and pray immediately.',
    ashar: '🌇 *ASHAR TIME*\n\n> Dear friend, Ashar prayer time has arrived.\n> Take your wudu and pray immediately.',
    maghrib: '🌆 *MAGHRIB TIME*\n\n> Dear friend, Maghrib prayer time has arrived.\n> Take your wudu and pray immediately.',
    isya: '🌙 *ISYA TIME*\n\n> Dear friend, Isya prayer time has arrived.\n> Take your wudu and pray immediately.'
};

const GAMBAR_SUASANA = {
    imsak: 'https://cdn.gimita.id/download/images_1769502277606_04d594fe.jfif',
    subuh: 'https://cdn.gimita.id/download/images_1769502277606_04d594fe.jfif',
    sunrise: 'https://cdn.gimita.id/download/images_1769502277606_04d594fe.jfif',
    dhuha: 'https://cdn.gimita.id/download/images_1769502277606_04d594fe.jfif',
    dzuhur: 'https://cdn.gimita.id/download/qf2d6868_sheikh-zayed-grand-mosque_625x300_04_March_25_1769502237718_92212561.webp',
    ashar: 'https://cdn.gimita.id/download/18537d69-a2e0-4dc2-a144-57dde0f359b5_1769502389063_5c004902.jpg',
    maghrib: 'https://cdn.gimita.id/download/mosque-5950407_1280_1769502206553_660ae15c.webp',
    isya: 'https://cdn.gimita.id/download/pngtree-nighttime-mosque-illustration-with-realistic-details-celebrating-ramadan-kareem-mubarak-image_3814083_1769502091988_e4cf3326.jpg'
};

const AUDIO_ADZAN = 'https://media.vocaroo.com/mp3/1ofLT2YUJAjQ';

let lastNotifiedTime = '';
let prayerInterval = null;
let sock = null;
let cachedSchedule = null;
let cacheDate = '';

function initSholatScheduler(socketInstance) {
    sock = socketInstance;

    if (prayerInterval) {
        clearInterval(prayerInterval);
    }

    prayerInterval = setInterval(checkPrayerTime, 30000);
    logger.info('PrayerScheduler', 'Prayer time scheduler started (real-time API)');
}

function getCurrentTimeWIB() {
    const timeHelper = require('./timeHelper');
    return timeHelper.getCurrentTimeString();
}

function getTodayDateString() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

async function loadTodaySchedule() {
    const todayStr = getTodayDateString();
    if (cachedSchedule && cacheDate === todayStr) return cachedSchedule;

    const db = getDatabase();
    const citySetting = db.setting('autoSholatKota') || { id: '1301', name: 'JAKARTA CITY' };

    try {
        const scheduleData = await getTodaySchedule(citySetting.id);
        cachedSchedule = extractPrayerTimes(scheduleData);
        cacheDate = todayStr;
        return cachedSchedule;
    } catch (e) {
        logger.error('PrayerScheduler', `Failed to fetch schedule: ${e.message}`);
        return null;
    }
}

function isTimeMatch(current, target) {
    if (current === target) return true;
    const [ch, cm] = current.split(':').map(Number);
    const [th, tm] = target.split(':').map(Number);
    const diff = Math.abs((ch * 60 + cm) - (th * 60 + tm));
    return diff === 0;
}

async function checkPrayerTime() {
    if (!sock) return;

    const db = getDatabase();
    const globalEnabled = db.setting('autoSholat');

    if (!globalEnabled) return;

    const currentTime = getCurrentTimeWIB();

    if (currentTime === lastNotifiedTime) return;

    const schedule = await loadTodaySchedule();
    if (!schedule) return;

    for (const [prayer, time] of Object.entries(schedule)) {
        if (time === '-') continue;
        if (isTimeMatch(currentTime, time)) {
            lastNotifiedTime = currentTime;
            await sendPrayerNotifications(prayer, time);

            setTimeout(() => {
                lastNotifiedTime = '';
            }, 120000);

            break;
        }
    }
}

async function sendPrayerNotifications(prayer, time) {
    try {
        const db = getDatabase();

        const closeGroup = db.setting('autoSholatCloseGroup') || false;
        const duration = db.setting('autoSholatDuration') || 5;
        const sendAudio = db.setting('autoSholatAudio') !== false;
        const citySetting = db.setting('autoSholatKota') || { name: 'JAKARTA CITY' };

        const channelId = config.saluran?.id || '120363401718869058@newsletter';
        const channelName = config.saluran?.name || config.bot?.name || 'Ourin-AI';

        let groupList = [];
        try {
            const groupsObj = await sock.groupFetchAllParticipating();
            groupList = Object.keys(groupsObj);
        } catch (e) {
            logger.error('PrayerScheduler', `Failed to fetch groups: ${e.message}`);
            return;
        }

        if (groupList.length === 0) return;

        let sentCount = 0;
        const closedGroups = [];

        const isPrayerTime = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'].includes(prayer);

        let message = `${SHOLAT_MESSAGES[prayer] || `🕌 *${prayer.toUpperCase()} TIME*`}\n\n⏰ *${time} WIB*\n📍 *${citySetting.name}*`;

        if (closeGroup && isPrayerTime) {
            message += `\n\n> 🔒 _Group closed for ${duration} minutes for prayer_`;
        }

        for (const groupId of groupList) {
            const groupData = db.data?.groups?.[groupId] || {};
            if (groupData.notifSholat === false) continue;

            try {
                if (sendAudio && isPrayerTime) {
                    await sock.sendMessage(groupId, {
                        audio: { url: AUDIO_ADZAN },
                        mimetype: 'audio/mpeg',
                        ptt: false,
                        contextInfo: {
                            externalAdReply: {
                                title: `🕌 Time for ${prayer.charAt(0).toUpperCase() + prayer.slice(1)} has arrived`,
                                body: `${citySetting.name} | Source: myquran.com`,
                                thumbnailUrl: GAMBAR_SUASANA[prayer],
                                sourceUrl: 'https://prayertime.worship',
                                mediaType: 1,
                                renderLargerThumbnail: true
                            },
                            forwardingScore: 9999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: channelId,
                                newsletterName: channelName,
                                serverMessageId: 127
                            }
                        }
                    });
                } else {
                    await sock.sendMessage(groupId, {
                        text: message,
                        contextInfo: {
                            externalAdReply: {
                                title: `🕌 Time for ${prayer.charAt(0).toUpperCase() + prayer.slice(1)}`,
                                body: `${time} WIB | ${citySetting.name}`,
                                thumbnailUrl: GAMBAR_SUASANA[prayer],
                                sourceUrl: config.saluran?.link || 'https://prayertime.worship',
                                mediaType: 1,
                                renderLargerThumbnail: true
                            },
                            forwardingScore: 9999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: channelId,
                                newsletterName: channelName,
                                serverMessageId: 127
                            }
                        }
                    });
                }

                if (closeGroup && isPrayerTime) {
                    try {
                        await sock.groupSettingUpdate(groupId, 'announcement');
                        closedGroups.push(groupId);
                    } catch (e) {
                        logger.error('PrayerScheduler', `Failed to close ${groupId}: ${e.message}`);
                    }
                }

                sentCount++;

                await new Promise(r => setTimeout(r, 500));
            } catch (err) {
                logger.error('PrayerScheduler', `Failed to send to ${groupId}: ${err.message}`);
            }
        }

        if (closeGroup && closedGroups.length > 0) {
            setTimeout(async () => {
                for (const groupId of closedGroups) {
                    try {
                        await sock.groupSettingUpdate(groupId, 'not_announcement');
                        await sock.sendMessage(groupId, {
                            text: `✅ Group reopened after ${prayer} prayer.\n\n> May our prayers be accepted. Aamiin 🤲`,
                            contextInfo: {
                                forwardingScore: 9999,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: channelId,
                                    newsletterName: channelName,
                                    serverMessageId: 127
                                }
                            }
                        });
                        await new Promise(r => setTimeout(r, 600));
                    } catch (e) {
                        logger.error('PrayerScheduler', `Failed to open ${groupId}: ${e.message}`);
                    }
                }
                logger.info('PrayerScheduler', `Opened ${closedGroups.length} groups after ${prayer}`);
            }, duration * 60 * 1000);
        }

        if (sentCount > 0) {
            logger.info('PrayerScheduler', `Sent ${prayer} notification to ${sentCount} groups` + (closedGroups.length > 0 ? ` (${closedGroups.length} closed)` : ''));
        }

    } catch (error) {
        logger.error('PrayerScheduler', `Error: ${error.message}`);
    }
}

function stopSholatScheduler() {
    if (prayerInterval) {
        clearInterval(prayerInterval);
        prayerInterval = null;
        logger.info('PrayerScheduler', 'Prayer time scheduler stopped');
    }
}

module.exports = {
    initSholatScheduler,
    stopSholatScheduler,
    SHOLAT_MESSAGES,
    GAMBAR_SUASANA,
    AUDIO_ADZAN
};