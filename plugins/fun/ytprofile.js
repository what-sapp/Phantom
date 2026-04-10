const BASE_URL = 'https://api.denayrestapi.xyz'

const pluginConfig = {
    name: ['ytprofile', 'youtubeprofile'],
    alias: [],
    category: 'canvas',
    description: 'Generate gambar profil YouTube',
    usage: '.ytprofile <username>|<displayName>|<bio>|<videos>|<subscribers>|<verified>',
    example: '.ytprofile Zann|Zann Official|Content Creator|90|998999|true',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const text = m.text?.trim()

    if (!text || !text.includes('|')) {
        return m.reply(
            `📺 *ʏᴛ ᴘʀᴏꜰɪʟᴇ ɢᴇɴᴇʀᴀᴛᴏʀ*\n\n` +
            `*Format:*\n` +
            `> username|displayName|bio|videos|subscribers|verified\n\n` +
            `*Contoh:*\n` +
            `> \`${m.prefix}ytprofile Zann|Zann Official|Creator|90|998999|true\`\n\n` +
            `💡 Reply gambar untuk custom banner`
        )
    }

    const parts = text.split('|').map(s => s.trim())
    const [username, displayName, bio, videos, subscribers, verified] = parts

    if (!username) return m.reply('❌ Username wajib diisi!')

    m.react('📺')

    try {
        let profileImageUrl = 'https://i.pinimg.com/736x/0c/b5/a4/0cb5a4c54ecd6475f559a07066cb1e87.jpg'
        let bannerImageUrl = 'https://c4.wallpaperflare.com/wallpaper/108/140/869/digital-digital-art-artwork-fantasy-art-drawing-hd-wallpaper-preview.jpg'

        try {
            profileImageUrl = await sock.profilePictureUrl(m.sender, 'image')
        } catch {}

        if (m.quoted) {
            const quotedType = m.quoted.type
            if (quotedType === 'imageMessage') {
                const buffer = await m.quoted.download()
                if (buffer) {
                    const { uploadImage } = require('../../src/lib/uploader')
                    const uploaded = await uploadImage(buffer, 'banner.jpg')
                    if (uploaded) bannerImageUrl = uploaded
                }
            }
        }

        const params = new URLSearchParams({
            username: username,
            displayName: displayName || username,
            bio: bio || '',
            profileImageUrl,
            bannerImageUrl,
            videos: videos || '0',
            subscribers: subscribers || '0',
            verified: verified === 'true' ? 'true' : 'false'
        })

        const apiUrl = `${BASE_URL}/api/v1/maker/ytprofile?${params.toString()}`

        await sock.sendMessage(m.chat, {
            image: { url: apiUrl },
            caption: `📺 *YouTube Profile*\n> @${username}`
        }, { quoted: m })

        m.react('✅')
    } catch (err) {
        m.react('❌')
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> ${err.message}`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
