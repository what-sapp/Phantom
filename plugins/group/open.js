const pluginConfig = {
    name: 'open',
    alias: ['buka', 'opengroup', 'bukagroup'],
    category: 'group',
    description: 'Membuka grup agar semua member bisa chat',
    usage: '.open',
    example: '.open',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true,
    isAdmin: true,
    isBotAdmin: true
};

async function handler(m, { sock }) {
    try {
        const groupMeta = m.groupMetadata;
        
        if (!groupMeta.announce) {
            await m.reply(
                `⚠️ *ᴠᴀʟɪᴅᴀsɪ ɢᴀɢᴀʟ*\n\n` +
                `> Grup sudah dalam keadaan \`terbuka\`.\n` +
                `> Semua member sudah bisa mengirim pesan.`
            );
            return;
        }
        
        await sock.groupSettingUpdate(m.chat, 'not_announcement');
        
        const senderNum = m.sender.split('@')[0];
        
        const successMsg = `🔓 *ɢʀᴜᴘ ᴅɪʙᴜᴋᴀ*

╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」
┃ ㊗ sᴛᴀᴛᴜs: *🟢 OPEN*
┃ ㊗ ᴀᴋsᴇs: *Semua Member*
┃ ㊗ ʙʏ: *@${senderNum}*
╰┈┈⬡

> _Sekarang semua member bisa mengirim pesan di grup ini._`;
        
        await sock.sendMessage(m.chat, {
            text: successMsg,
            mentions: [m.sender]
        }, { quoted: m });
        
    } catch (error) {
        await m.reply(
            `❌ *ᴇʀʀᴏʀ*\n\n` +
            `> Gagal membuka grup.\n` +
            `> _${error.message}_`
        );
    }
}

module.exports = {
    config: pluginConfig,
    handler
};
