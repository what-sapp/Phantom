const config = {

    info: {
        website: 'https://sc.ourin.my.id',
        grupwa: 'https://chat.whatsapp.com/HbzpnHdLxLeDfOYa33hSAw'
    },

    owner: {
        name: 'Phantom dev',                    // Owner name
        number: ['254784937112']         // Format: 628xxx (without + or 0)
    },

    session: {
        pairingNumber: '254784937112',   // WhatsApp number to pair
        usePairingCode: true              // true = Pairing Code, false = QR Code
    },

    bot: {
        name: 'PHANTOM X',                 // Bot name
        version: '2.1.0',                 // Bot version
        developer: 'Phantom dev'          // Developer name
    },

    mode: 'public',

    command: {
        prefix: '.'                      // Main prefix (.menu, .help, etc)
    },

    vercel: {
        // get vercel token: https://vercel.com/account/tokens
        token: ''                        // Vercel Token for deploy feature (if .deploy needs to work, this must be filled)
    },

    store: {
        payment: [
            { name: 'Dana', number: '62', holder: 'username' },
            { name: 'OVO', number: '62', holder: 'username' },
            { name: 'GoPay', number: '62', holder: 'username' },
            { name: 'ShopeePay', number: '62', holder: 'username' }
        ],
        qris: 'https://files.cloudkuimages.guru/images/51a2c5186302.jpg'
    },

    donasi: {
        payment: [
            { name: 'Dana', number: '08', holder: 'username' },
            { name: 'GoPay', number: '08', holder: 'username' },
            { name: 'OVO', number: '08', holder: 'username' }
        ],
        links: [
            { name: 'Saweria', url: 'saweria.co/username' },
            { name: 'Trakteer', url: 'trakteer.id/username' }
        ],
        benefits: [
            'Support development',
            'More stable server',
            'Faster new features',
            'Priority support'
        ],
        qris: 'https://files.cloudkuimages.guru/images/51a2c5186302.jpg'
    },

    energi: {
        enabled: false, // If true, the energy/limit system will work
        default: 99999,
        premium: 99999999,
        owner: -1
    },

    sticker: {
        packname: 'PHANTOM X',        
        author: 'Phanrom Dev'              
    },

    saluran: {
        id: '120363397100406773@newsletter',
        name: 'Phantom X',     
        link: 'https://whatsapp.com/channel/0029Vb5sKCeInlqQbjzsFT0g'                        
    },

    groupProtection: {
        antilink: '⚠ *Antilink* — @%user% sent a link.\nMessage deleted.',
        antilinkKick: '⚠ *Antilink* — @%user% was kicked for sending a link.',
        antilinkGc: '⚠ *WA Antilink* — @%user% sent a WA link.\nMessage deleted.',
        antilinkGcKick: '⚠ *WA Antilink* — @%user% was kicked for sending a WA link.',
        antilinkAll: '⚠ *Antilink* — @%user% sent a link.\nMessage deleted.',
        antilinkAllKick: '⚠ *Antilink* — @%user% was kicked for sending a link.',
        antitagsw: '⚠ *AntiTagSW* — Status tag from @%user% deleted.',
        antiviewonce: '👁️ *ViewOnce* — From @%user%',
        antiremove: '🗑️ *AntiDelete* — @%user% deleted a message:',
        antihidetag: '⚠ *AntiHidetag* — Hidetag from @%user% deleted.',
        antitoxicWarn: '⚠ @%user% spoke rudely.\nWarning %warn% of %max%, next violation may result in %method%.',
        antitoxicAction: '🚫 @%user% was %method% for being toxic. (%warn%/%max%)',
        antidocument: '⚠ *AntiDocument* — Document from @%user% deleted.',
        antisticker: '⚠ *AntiSticker* — Sticker from @%user% deleted.',
        antimedia: '⚠ *AntiMedia* — Media from @%user% deleted.',
        antibot: '🤖 *AntiBot* — @%user% detected as a bot and kicked.',
        notAdmin: '⚠ Bot is not admin, cannot delete messages.'
    },

    features: {
        antiSpam: true,
        antiSpamInterval: 3000,
        antiCall: false, // If true, bot will reject incoming calls
        blockIfCall: false, // If true, bot will block numbers that call it
        autoTyping: true,
        autoRead: false,
        logMessage: true,
        dailyLimitReset: false,
        smartTriggers: false
    },

    registration: {
        enabled: false, // If true, user must register before using the bot
        rewards: {
            koin: 30000,
            energi: 300,
            exp: 300000
        }
    },

    welcome: { defaultEnabled: false },
    goodbye: { defaultEnabled: false },

    premiumUsers: [],
    partnerUsers: [],
    bannedUsers: [],


    ui: {
        menuVariant: 3
    },

    messages: {
        wait: '⏳ *Processing...* Please wait a moment.',
        success: '✅ *Success!* Your request has been completed.',
        error: '❌ *Error!* There is a system issue, please try again later.',

        ownerOnly: '*Access Denied!* This feature is for the bot owner only.',
        premiumOnly: '💎 *Premium Only!* This feature is for Premium members only. Type *.benefitpremium* for upgrade info.',

        groupOnly: '👥 *Group Only!* This feature can only be used in a group.',
        privateOnly: '💬 *Private Only!* This feature can only be used in private chat with the bot.',

        adminOnly: '👑 *Admin Only!* You must be a group admin to use this feature.',
        botAdminOnly: '🤖 *Bot is not Admin!* Make the bot a group admin first so it can work.',

        cooldown: '⏳ *Please Wait!* You are still in cooldown. Wait %time% seconds.',
        energiExceeded: '⚡ *Energy Exhausted!* Your energy is depleted. Wait for tomorrow\'s reset or buy Premium.',

        banned: '🚫 *You Are Banned!* You cannot use this bot because you have violated the rules.',

        rejectCall: '🚫 DO NOT CALL THIS NUMBER',
    },

    database: { path: './database/main' },
    backup: { enabled: false, intervalHours: 24, retainDays: 7 },
    scheduler: { resetHour: 0, resetMinute: 0 },

// Dev mode settings (auto-enabled if NODE_ENV=development)
    dev: {
        enabled: process.env.NODE_ENV === 'development',
        watchPlugins: true,    // Hot reload plugins (SAFE)
        watchSrc: false,       // DISABLED - src reload causes connection conflict 440
        debugLog: false        // Show stack traces
    },

    // can be left empty
    pterodactyl: {
        server1: {
            domain: '',
            apikey: '',
            capikey: '',
            egg: '15',
            nestid: '5',
            location: '1'
        },
        server2: {
            domain: '',
            apikey: '',
            capikey: '',
            egg: '15',
            nestid: '5',
            location: '1'
        },
        server3: {
            domain: '',
            apikey: '',
            capikey: '',
            egg: '15',
            nestid: '5',
            location: '1'
        },
        server4: {
            domain: '',
            apikey: '',
            capikey: '',
            egg: '15',
            nestid: '5',
            location: '1'
        },
        server5: {
            domain: '',
            apikey: '',
            capikey: '',
            egg: '15',
            nestid: '5',
            location: '1'
        }
    },

    digitalocean: {
        token: '',
        region: 'sgp1',
        sellers: [],
        ownerPanels: []
    },

    // NOTE: this is not available in the free version, only in the pt version
    // register at: https://pakasir.com/
    pakasir: {
        enabled: true,
        slug: '-',
        apiKey: '-',
        defaultMethod: 'qris',
        sandbox: false,
        pollingInterval: 5000
    },
    
    // NOTE: this is not available in the free version, only in the pt version
    // Get apikey at: https://ditznesia.id -> Register -> Go to Profile -> Get Apikey
    jasaotp: {
        apiKey: '',
        markup: 2000,
        timeout: 300
    },

    // API keys
    APIkey: {
        lolhuman: 'APIKey-Milik-Bot-OurinMD(Zann,HyuuSATANN,Keisya,Danzz)',
        neoxr: 'Milik-Bot-OurinMD',
        google: 'AIzaSyAS-KiW0SrwiYKwexeBcGPijBVHFg2R_vo',
        groq: '' // Groq API Key for transcription feature (free at console.groq.com)
    }
}


// HELPER FUNCTIONS - Don't change or you'll mess up!

function isOwner(number) {
    if (!number) return false
    const cleanNumber = number.replace(/[^0-9]/g, '')
    if (!cleanNumber) return false
    
    try {
        const { getDatabase } = require('./src/lib/database')
        const db = getDatabase()
        const cleanNumber = number?.replace(/[^0-9]/g, '') || ''
        
        if (!cleanNumber) return false
        if (config.owner && config.owner.number && config.owner.number.includes(cleanNumber)) {
            return true
        }
        
        if (db && db.data && Array.isArray(db.data.owner)) {
            if (db.data.owner.includes(cleanNumber)) return true
        }
        if (db) {
            const definedOwner = db.setting('ownerNumbers')
            if (Array.isArray(definedOwner) && definedOwner.includes(cleanNumber)) return true
        }
        
        return false
    } catch {
        return false
    }
}

function isPremium(number) {
    if (!number) return false
    if (isOwner(number)) return true
    
    const cleanNumber = number.replace(/[^0-9]/g, '')
    const premiumList = config.premiumUsers || []
    
    const inConfig = premiumList.some(premium => {
        if (!premium) return false
        const cleanPremium = premium.replace(/[^0-9]/g, '')
        return cleanNumber === cleanPremium || cleanNumber.endsWith(cleanPremium) || cleanPremium.endsWith(cleanNumber)
    })
    
    if (inConfig) return true
    
    try {
        const ownerPremiumDb = require('./src/lib/ownerPremiumDb')
        if (ownerPremiumDb.isPremium(cleanNumber)) return true
    } catch {}
    
    try {
        const { getDatabase } = require('./src/lib/database')
        const db = getDatabase()
        if (db && db.data && Array.isArray(db.data.premium)) {
             const now = Date.now()
             const found = db.data.premium.find(p => {
                if (typeof p === 'string') return p === cleanNumber
                if (p.id) return p.id === cleanNumber
                return false
            })
            
            if (found) {
                if (typeof found === 'string') return true
                if (found.expired && found.expired < now) return false
                return true
            }
        }
        if (db) {
            const savedPremium = db.setting('premiumUsers') || []
            const inDb = savedPremium.some(premium => {
                if (!premium) return false
                const cleanPremium = premium.replace(/[^0-9]/g, '')
                return cleanNumber === cleanPremium || cleanNumber.endsWith(cleanPremium) || cleanPremium.endsWith(cleanNumber)
            })
            if (inDb) return true
        }
    } catch {}
    
    return false
}

function isPartner(number) {
    if (!number) return false
    if (isOwner(number)) return true

    const cleanNumber = number.replace(/[^0-9]/g, '')
    const partnerList = config.partnerUsers || []

    const inConfig = partnerList.some(partner => {
        if (!partner) return false
        const cleanPartner = partner.replace(/[^0-9]/g, '')
        return cleanNumber === cleanPartner || cleanNumber.endsWith(cleanPartner) || cleanPartner.endsWith(cleanNumber)
    })

    if (inConfig) return true

    try {
        const ownerPremiumDb = require('./src/lib/ownerPremiumDb')
        if (ownerPremiumDb.isPartner(cleanNumber)) return true
    } catch {}

    return false
}

function isBanned(number) {
    if (!number) return false
    if (isOwner(number)) return false
    
    const cleanNumber = number.replace(/[^0-9]/g, '')
    return config.bannedUsers.some(banned => {
        const cleanBanned = banned.replace(/[^0-9]/g, '')
        return cleanNumber === cleanBanned || cleanNumber.endsWith(cleanBanned) || cleanBanned.endsWith(cleanNumber)
    })
}

function setBotNumber(number) {
    if (number) config.bot.number = number.replace(/[^0-9]/g, '')
}

function isSelf(number) {
    if (!number || !config.bot.number) return false
    const cleanNumber = number.replace(/[^0-9]/g, '')
    const botNumber = config.bot.number.replace(/[^0-9]/g, '')
    return cleanNumber.includes(botNumber) || botNumber.includes(cleanNumber)
}

function getConfig() { return config }

module.exports = {
    ...config,
    config,
    getConfig,
    isOwner,
    isPartner,
    isPremium,
    isBanned,
    setBotNumber,
    isSelf
}