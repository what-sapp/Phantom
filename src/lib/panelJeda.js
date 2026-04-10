const { getDatabase } = require('../../src/lib/database')

const DEFAULT_DELAY = 5 * 60 * 1000

function formatTime(ms) {
    if (ms <= 0) return '0 seconds'
    
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ${minutes % 60} minute${(minutes % 60) > 1 ? 's' : ''}`
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ${seconds % 60} second${(seconds % 60) > 1 ? 's' : ''}`
    return `${seconds} second${seconds > 1 ? 's' : ''}`
}

function checkPanelDelay(m) {
    const db = getDatabase()
    
    const storedDelay = db.setting('panelCreateJeda')
    const delayMs = storedDelay !== undefined && storedDelay !== null ? storedDelay : DEFAULT_DELAY
    
    if (delayMs === 0) return { allowed: true }
    
    const lastUsed = db.setting('panelCreateLastUsed') || 0
    const now = Date.now()
    const elapsed = now - lastUsed
    
    if (elapsed < delayMs) {
        const remaining = delayMs - elapsed
        return {
            allowed: false,
            remaining: remaining,
            message: `⏱️ *ᴅᴇʟᴀʏ ᴀᴄᴛɪᴠᴇ*\n\n` +
                `> Please wait *${formatTime(remaining)}* before creating another panel.\n\n` +
                `> _This delay applies to all users._\n` +
                `> _Use \`.checkdelay\` to check status._`
        }
    }
    
    return { allowed: true }
}

async function setPanelLastUsed() {
    const db = getDatabase()
    db.setting('panelCreateLastUsed', Date.now())
    await db.save()
}

function getDelayInfo() {
    const db = getDatabase()
    const storedDelay = db.setting('panelCreateJeda')
    const delayMs = storedDelay !== undefined && storedDelay !== null ? storedDelay : DEFAULT_DELAY
    const lastUsed = db.setting('panelCreateLastUsed') || 0
    const now = Date.now()
    const elapsed = now - lastUsed
    const remaining = Math.max(0, delayMs - elapsed)
    
    return {
        delayMs,
        lastUsed,
        elapsed,
        remaining,
        isReady: remaining === 0 || delayMs === 0
    }
}

module.exports = {
    checkPanelDelay: checkPanelJeda,
    setPanelLastUsed,
    formatTime,
    getDelayInfo: getJedaInfo,
    DEFAULT_DELAY: DEFAULT_JEDA
}