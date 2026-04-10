const { getDatabase } = require('./database');
const { logger } = require('./colors');
const moment = require('moment-timezone');

const scheduledTasks = new Map();
const activeIntervals = new Map();

function getMsUntilTime(hour, minute = 0) {
    const now = moment.tz('Africa/Kampala');
    const target = moment.tz('Africa/Kampala').hour(hour).minute(minute).second(0).millisecond(0);
    
    if (target.isSameOrBefore(now)) {
        target.add(1, 'day');
    }
    
    return target.diff(now);
}

/**
 * Format time remaining for display
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time
 */
function formatTimeRemaining(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

/**
 * Daily limit reset scheduler
 * Resets all user limits at specified time (default: 00:00)
 * @param {Object} options - Scheduler options
 * @param {number} [options.hour=0] - Reset hour (0-23)
 * @param {number} [options.minute=0] - Reset minute (0-59)
 * @param {number} [options.defaultLimit=25] - Default limit to reset to
 */
function startDailyLimitReset(options = {}) {
    const hour = options.hour ?? 0;
    const minute = options.minute ?? 0;
    const defaultLimit = options.defaultLimit ?? 25;
    
    const scheduleReset = () => {
        const msUntilReset = getMsUntilTime(hour, minute);
        
        logger.info('Scheduler', `Daily limit reset scheduled in ${formatTimeRemaining(msUntilReset)}`);
        
        const timeoutId = setTimeout(() => {
            try {
                const db = getDatabase();
                const resetCount = db.resetAllEnergi(defaultLimit, -1);
                logger.success('Scheduler', `Daily limit reset complete! ${resetCount} users reset (regular: ${defaultLimit}, premium: ∞)`);
                db.incrementStat('dailyResets');
                db.setting('lastLimitReset', new Date().toISOString());
                scheduleReset();
            } catch (error) {
                logger.error('Scheduler', `Daily limit reset failed: ${error.message}`);
                // Retry in 1 minute
                setTimeout(scheduleReset, 60000);
            }
        }, msUntilReset);
        
        activeIntervals.set('dailyLimitReset', timeoutId);
    };
    
    scheduleReset();
    logger.info('Scheduler', `Daily limit reset enabled at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
}

/**
 * Add a scheduled message
 * @param {Object} options - Message options
 * @param {string} options.id - Unique task ID
 * @param {string} options.jid - Target JID
 * @param {Object} options.message - Message content
 * @param {number} options.hour - Send hour (0-23)
 * @param {number} [options.minute=0] - Send minute (0-59)
 * @param {boolean} [options.repeat=false] - Repeat daily
 * @param {Object} sock - Socket connection
 * @returns {Object} Task info
 */
function scheduleMessage(options, sock) {
    const { id, jid, message, hour, minute = 0, repeat = false } = options;
    
    if (!id || !jid || !message || hour === undefined) {
        throw new Error('Missing required options: id, jid, message, hour');
    }
    
    // Cancel existing task with same ID
    if (scheduledTasks.has(id)) {
        cancelScheduledMessage(id);
    }
    
    const task = {
        id,
        jid,
        message,
        hour,
        minute,
        repeat,
        createdAt: new Date().toISOString(),
        nextRun: null
    };
    
    const scheduleTask = () => {
        const msUntilSend = getMsUntilTime(hour, minute);
        task.nextRun = new Date(Date.now() + msUntilSend).toISOString();
        
        const timeoutId = setTimeout(async () => {
            try {
                await sock.sendMessage(jid, message);
                logger.success('Scheduler', `Scheduled message sent: ${id}`);
                
                // Save to stats
                const db = getDatabase();
                db.incrementStat('scheduledMessagesSent');
                
                if (repeat) {
                    // Schedule next occurrence
                    scheduleTask();
                } else {
                    // Remove one-time task
                    scheduledTasks.delete(id);
                    activeIntervals.delete(id);
                }
            } catch (error) {
                logger.error('Scheduler', `Failed to send scheduled message ${id}: ${error.message}`);
                
                // Retry in 5 minutes
                setTimeout(() => scheduleTask(), 5 * 60 * 1000);
            }
        }, msUntilSend);
        
        activeIntervals.set(id, timeoutId);
        scheduledTasks.set(id, task);
    };
    
    scheduleTask();
    
    logger.info('Scheduler', `Message scheduled: ${id} at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    
    return task;
}

/**
 * Cancel a scheduled message
 * @param {string} id - Task ID
 * @returns {boolean} True if cancelled
 */
function cancelScheduledMessage(id) {
    if (activeIntervals.has(id)) {
        clearTimeout(activeIntervals.get(id));
        activeIntervals.delete(id);
    }
    
    if (scheduledTasks.has(id)) {
        scheduledTasks.delete(id);
        logger.info('Scheduler', `Cancelled scheduled message: ${id}`);
        return true;
    }
    
    return false;
}

/**
 * Get all scheduled messages
 * @returns {Object[]} Array of scheduled tasks
 */
function getScheduledMessages() {
    return Array.from(scheduledTasks.values());
}

/**
 * Get scheduled message by ID
 * @param {string} id - Task ID
 * @returns {Object|null} Task or null
 */
function getScheduledMessage(id) {
    return scheduledTasks.get(id) || null;
}

/**
 * Save scheduled messages to database for persistence
 */
function saveScheduledMessages() {
    try {
        const db = getDatabase();
        const tasks = Array.from(scheduledTasks.values());
        db.setting('scheduledMessages', tasks);
        logger.debug('Scheduler', `Saved ${tasks.length} scheduled messages`);
    } catch (error) {
        logger.error('Scheduler', `Failed to save scheduled messages: ${error.message}`);
    }
}

/**
 * Load scheduled messages from database
 * @param {Object} sock - Socket connection
 */
function loadScheduledMessages(sock) {
    try {
        const db = getDatabase();
        const savedTasks = db.setting('scheduledMessages') || [];
        
        for (const task of savedTasks) {
            if (task.repeat || new Date(task.nextRun) > new Date()) {
                scheduleMessage({
                    id: task.id,
                    jid: task.jid,
                    message: task.message,
                    hour: task.hour,
                    minute: task.minute,
                    repeat: task.repeat
                }, sock);
            }
        }
        
        logger.info('Scheduler', `Loaded ${savedTasks.length} scheduled messages`);
    } catch (error) {
        logger.error('Scheduler', `Failed to load scheduled messages: ${error.message}`);
    }
}

/**
 * Stop all schedulers
 */
function stopAllSchedulers() {
    // Save before stopping
    saveScheduledMessages();
    
    // Clear all intervals
    for (const [id, timeout] of activeIntervals) {
        clearTimeout(timeout);
        logger.debug('Scheduler', `Stopped: ${id}`);
    }
    
    activeIntervals.clear();
    logger.info('Scheduler', 'All schedulers stopped');
}

/**
 * Get scheduler status
 * @returns {Object} Status info
 */
function getSchedulerStatus() {
    const db = getDatabase();
    
    return {
        dailyResetEnabled: activeIntervals.has('dailyLimitReset'),
        lastLimitReset: db.setting('lastLimitReset') || 'Never',
        scheduledMessagesCount: scheduledTasks.size,
        totalResets: db.getStats('dailyResets'),
        totalMessagesSent: db.getStats('scheduledMessagesSent')
    };
}

const schedulerRegistry = {
    dailyLimitReset: { name: 'Daily Limit Reset', key: 'dailyLimitReset', description: 'Reset user limit at 00:00' },
    groupSchedule: { name: 'Group Schedule', key: 'groupSchedule', description: 'Auto open/close group' },
    sewaChecker: { name: 'Rental Checker', key: 'sewaChecker', description: 'Check expired rental at 00:00' },
    scheduledMessages: { name: 'Scheduled Messages', key: 'scheduledMessages', description: 'User scheduled messages' }
};

function isSchedulerRunning(name) {
    const key = name.toLowerCase().replace(/[\s-]/g, '');
    
    if (key === 'dailylimitreset' || key === 'limitreset' || key === 'limit') {
        return activeIntervals.has('dailyLimitReset');
    }
    if (key === 'groupschedule' || key === 'groupsched' || key === 'group') {
        return !!groupScheduleSock;
    }
    if (key === 'sewachecker' || key === 'sewa') {
        return activeIntervals.has('sewaChecker');
    }
    if (key === 'scheduledmessages' || key === 'messages' || key === 'msg') {
        return scheduledTasks.size > 0;
    }
    
    return false;
}

function getFullSchedulerStatus() {
    const db = getDatabase();
    
    const status = {
        schedulers: [
            {
                name: 'Daily Limit Reset',
                key: 'limitreset',
                running: activeIntervals.has('dailyLimitReset'),
                description: 'Reset user limit at 00:00',
                lastRun: db.setting('lastLimitReset') || 'Never',
                stats: { totalResets: db.getStats('dailyResets') || 0 }
            },
            {
                name: 'Group Schedule',
                key: 'groupschedule',
                running: !!groupScheduleSock,
                description: 'Auto open/close scheduled groups',
                lastRun: '-',
                stats: {}
            },
            {
                name: 'Rental Checker',
                key: 'sewa',
                running: activeIntervals.has('sewaChecker'),
                description: 'Check expired group rental at 00:00',
                lastRun: '-',
                stats: {}
            },
            {
                name: 'Scheduled Messages',
                key: 'messages',
                running: scheduledTasks.size > 0 || activeIntervals.size > 2,
                description: 'User scheduled messages',
                lastRun: '-',
                stats: { 
                    activeMessages: scheduledTasks.size,
                    totalSent: db.getStats('scheduledMessagesSent') || 0
                }
            }
        ],
        summary: {
            totalActive: 0,
            totalInactive: 0
        }
    };
    
    status.schedulers.forEach(s => {
        if (s.running) status.summary.totalActive++;
        else status.summary.totalInactive++;
    });
    
    return status;
}

function stopSchedulerByName(name) {
    const key = name.toLowerCase().replace(/[\s-]/g, '');
    let stopped = false;
    let schedulerName = '';
    
    if (key === 'dailylimitreset' || key === 'limitreset' || key === 'limit') {
        if (activeIntervals.has('dailyLimitReset')) {
            clearTimeout(activeIntervals.get('dailyLimitReset'));
            activeIntervals.delete('dailyLimitReset');
            stopped = true;
            schedulerName = 'Daily Limit Reset';
        }
    }
    
    if (key === 'groupschedule' || key === 'groupsched' || key === 'group') {
        groupScheduleSock = null;
        stopped = true;
        schedulerName = 'Group Schedule';
    }
    
    if (key === 'sewachecker' || key === 'sewa') {
        if (activeIntervals.has('sewaChecker')) {
            clearTimeout(activeIntervals.get('sewaChecker'));
            activeIntervals.delete('sewaChecker');
            stopped = true;
            schedulerName = 'Rental Checker';
        }
        sewaSock = null;
    }
    
    if (key === 'scheduledmessages' || key === 'messages' || key === 'msg') {
        for (const [id] of scheduledTasks) {
            cancelScheduledMessage(id);
        }
        stopped = true;
        schedulerName = 'Scheduled Messages';
    }
    
    if (key === 'all') {
        stopAllSchedulers();
        return { stopped: true, name: 'All Schedulers' };
    }
    
    if (stopped) {
        logger.info('Scheduler', `Stopped: ${schedulerName}`);
    }
    
    return { stopped, name: schedulerName };
}

function startSchedulerByName(name, sock, config = null) {
    const key = name.toLowerCase().replace(/[\s-]/g, '');
    let started = false;
    let schedulerName = '';
    
    const cfg = config || require('../../config');
    
    if (key === 'dailylimitreset' || key === 'limitreset' || key === 'limit') {
        if (!activeIntervals.has('dailyLimitReset')) {
            startDailyLimitReset({
                hour: cfg.scheduler?.resetHour ?? 0,
                minute: cfg.scheduler?.resetMinute ?? 0,
                defaultLimit: cfg.energi?.default ?? 25
            });
            started = true;
            schedulerName = 'Daily Limit Reset';
        }
    }
    
    if (key === 'groupschedule' || key === 'groupsched' || key === 'group') {
        if (sock) {
            startGroupScheduleChecker(sock);
            started = true;
            schedulerName = 'Group Schedule';
        }
    }
    
    if (key === 'sewachecker' || key === 'sewa') {
        if (sock && !activeIntervals.has('sewaChecker')) {
            startSewaChecker(sock);
            started = true;
            schedulerName = 'Rental Checker';
        }
    }
    
    if (key === 'scheduledmessages' || key === 'messages' || key === 'msg') {
        if (sock) {
            loadScheduledMessages(sock);
            started = true;
            schedulerName = 'Scheduled Messages';
        }
    }
    
    if (key === 'all') {
        if (sock) {
            initScheduler(cfg, sock);
            startGroupScheduleChecker(sock);
            startSewaChecker(sock);
            return { started: true, name: 'All Schedulers' };
        }
    }
    
    if (started) {
        logger.info('Scheduler', `Started: ${schedulerName}`);
    }
    
    return { started, name: schedulerName };
}

/**
 * Initialize scheduler with config
 * @param {Object} config - Bot config
 * @param {Object} sock - Socket connection (optional, needed for scheduled messages)
 */
function initScheduler(config, sock = null) {
    // Start daily limit reset if enabled
    if (config.features?.dailyLimitReset !== false) {
        startDailyLimitReset({
            hour: config.scheduler?.resetHour ?? 0,
            minute: config.scheduler?.resetMinute ?? 0,
            defaultLimit: config.energi?.default ?? 25
        });
    }
    
    // Load saved scheduled messages
    if (sock) {
        loadScheduledMessages(sock);
    }
    
    // Auto-save scheduled messages every 5 minutes
    setInterval(() => {
        if (scheduledTasks.size > 0) {
            saveScheduledMessages();
        }
    }, 5 * 60 * 1000);
    
    logger.success('Scheduler', 'Scheduler initialized');
}

let groupScheduleSock = null;
let groupScheduleInterval = null;
const notifiedGroups = new Set();

function startGroupScheduleChecker(sock) {
    if (groupScheduleInterval) {
        clearInterval(groupScheduleInterval);
        logger.debug('Scheduler', 'Cleared old group schedule interval');
    }
    
    groupScheduleSock = sock;
    notifiedGroups.clear();
    
    groupScheduleInterval = setInterval(async () => {
        if (!groupScheduleSock) return;
        
        try {
            const db = getDatabase();
            const now = moment.tz('Asia/Jakarta');
            const currentTime = now.format('HH:mm');
            
            const groups = db.db?.data?.groups || {};
            
            if (!groups || typeof groups !== 'object') return;
            
            for (const [groupId, group] of Object.entries(groups)) {
                if (!group || typeof group !== 'object') continue;
                
                const notifyKey = `${groupId}_${currentTime}`;
                if (notifiedGroups.has(notifyKey)) continue;
                
                if (group.scheduleOpen === currentTime) {
                    try {
                        await groupScheduleSock.groupSettingUpdate(groupId, 'not_announcement');
                        await groupScheduleSock.sendMessage(groupId, {
                            text: `🔓 *ᴀᴜᴛᴏ ᴏᴘᴇɴ*\n\n> Group opened automatically according to schedule.\n> Time: ${currentTime} WIB`
                        });
                        notifiedGroups.add(notifyKey);
                        logger.success('GroupSchedule', `Opened group ${groupId} at ${currentTime}`);
                    } catch (e) {
                        if (e.message?.includes('not-authorized') || e.message?.includes('admin')) {
                            logger.warn('GroupSchedule', `Bot is not admin in ${groupId}, cannot open group`);
                            try {
                                await groupScheduleSock.sendMessage(groupId, {
                                    text: `⚠️ *ᴀᴜᴛᴏ ᴏᴘᴇɴ ғᴀɪʟᴇᴅ*\n\n> Bot is not admin, cannot change group settings.\n> Make the bot an admin to enable this feature.`
                                });
                            } catch {}
                        } else {
                            logger.error('GroupSchedule', `Failed to open ${groupId}: ${e.message}`);
                        }
                        notifiedGroups.add(notifyKey);
                    }
                }
                
                if (group.scheduleClose === currentTime) {
                    try {
                        await groupScheduleSock.groupSettingUpdate(groupId, 'announcement');
                        await groupScheduleSock.sendMessage(groupId, {
                            text: `🔒 *ᴀᴜᴛᴏ ᴄʟᴏsᴇ*\n\n> Group closed automatically according to schedule.\n> Time: ${currentTime} WIB`
                        });
                        notifiedGroups.add(notifyKey);
                        logger.success('GroupSchedule', `Closed group ${groupId} at ${currentTime}`);
                    } catch (e) {
                        if (e.message?.includes('not-authorized') || e.message?.includes('admin')) {
                            logger.warn('GroupSchedule', `Bot is not admin in ${groupId}, cannot close group`);
                            try {
                                await groupScheduleSock.sendMessage(groupId, {
                                    text: `⚠️ *ᴀᴜᴛᴏ ᴄʟᴏsᴇ ғᴀɪʟᴇᴅ*\n\n> Bot is not admin, cannot change group settings.\n> Make the bot an admin to enable this feature.`
                                });
                            } catch {}
                        } else {
                            logger.error('GroupSchedule', `Failed to close ${groupId}: ${e.message}`);
                        }
                        notifiedGroups.add(notifyKey);
                    }
                }
            }
            
            if (now.minute() === 0) {
                notifiedGroups.clear()
            }
        } catch (error) {
            logger.error('GroupSchedule', `Checker error: ${error.message}`);
        }
    }, 60 * 1000);
    
    logger.info('Scheduler', 'Group schedule checker started');
}

let sewaSock = null;

function startSewaChecker(sock) {
    sewaSock = sock;
    
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    
    const scheduleCheck = () => {
        const msUntilMidnight = getMsUntilTime(0, 0);
        
        logger.info('Scheduler', `Rental checker scheduled in ${formatTimeRemaining(msUntilMidnight)}`);
        
        const timeoutId = setTimeout(async () => {
            try {
                const db = getDatabase();
                
                if (!db.db.data.sewa?.enabled) {
                    scheduleCheck();
                    return;
                }
                
                const rentalGroups = db.db.data.sewa.groups || {};
                const now = Date.now();
                let expiredCount = 0;
                let warnedCount = 0;
                
                for (const [groupId, data] of Object.entries(rentalGroups)) {
                    if (data.isLifetime) continue;
                    
                    if (data.expiredAt <= now) {
                        try {
                            await sewaSock.sendMessage(groupId, {
                                text:
                                    `⏰ *ʀᴇɴᴛᴀʟ ᴇxᴘɪʀᴇᴅ*\n\n` +
                                    `> The bot rental period in this group has expired.\n` +
                                    `> Bot will leave the group.\n\n` +
                                    `_Contact the owner to renew the rental._`
                            });
                            await new Promise(r => setTimeout(r, 2000));
                            await sewaSock.groupLeave(groupId);
                            delete db.db.data.sewa.groups[groupId];
                            expiredCount++;
                            await new Promise(r => setTimeout(r, 3000));
                        } catch (e) {
                            logger.error('Scheduler', `Failed to leave expired group: ${e.message}`);
                        }
                        continue;
                    }
                    
                    const remaining = data.expiredAt - now;
                    if (remaining <= THREE_DAYS_MS && !data._warned3d) {
                        try {
                            const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
                            const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                            await sewaSock.sendMessage(groupId, {
                                text:
                                    `⚠️ *ʀᴇɴᴛᴀʟ ᴡᴀʀɴɪɴɢ*\n\n` +
                                    `> Rental period has \`${days}d ${hours}h\` remaining\n` +
                                    `> Contact the owner immediately to renew.\n\n` +
                                    `_If not renewed, the bot will automatically leave._`
                            });
                            data._warned3d = true;
                            warnedCount++;
                            await new Promise(r => setTimeout(r, 2000));
                        } catch {}
                    }
                }
                
                if (expiredCount > 0 || warnedCount > 0) {
                    db.db.write();
                    logger.success('Scheduler', `Rental check: ${expiredCount} expired, ${warnedCount} warned`);
                }
                
                scheduleCheck();
            } catch (error) {
                logger.error('Scheduler', `Rental check failed: ${error.message}`);
                setTimeout(scheduleCheck, 60000);
            }
        }, msUntilMidnight);
        
        activeIntervals.set('sewaChecker', timeoutId);
    };
    
    scheduleCheck();
    logger.info('Scheduler', 'Rental checker enabled at 00:00');
}

module.exports = {
    initScheduler,
    stopAllSchedulers,
    startDailyLimitReset,
    startGroupScheduleChecker,
    startSewaChecker,
    scheduleMessage,
    cancelScheduledMessage,
    getScheduledMessages,
    getScheduledMessage,
    saveScheduledMessages,
    loadScheduledMessages,
    getMsUntilTime,
    formatTimeRemaining,
    getSchedulerStatus,
    getFullSchedulerStatus,
    isSchedulerRunning,
    startSchedulerByName,
    stopSchedulerByName
};