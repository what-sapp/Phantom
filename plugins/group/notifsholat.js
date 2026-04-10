const { getDatabase } = require('../../src/lib/database');

const pluginConfig = {
    name: 'notifsholat',
    alias: ['notifsolat'],
    category: 'group',
    description: 'Toggle notifikasi sholat untuk grup ini',
    usage: '.notifsholat on/off',
    example: '.notifsholat on',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

async function handler(m, { sock, db }) {
    if (!m.isAdmin && !m.isOwner) {
        return m.reply(`❌ Hanya admin grup yang bisa menggunakan fitur ini`);
    }

    const args = m.args[0]?.toLowerCase();
    const group = db.getGroup(m.chat) || {};
    const globalDb = getDatabase();
    const kotaSetting = globalDb.setting('autoSholatKota') || { nama: 'KOTA JAKARTA' };

    if (!['on', 'off'].includes(args)) {
        const status = group.notifSholat !== false ? '✅ Aktif' : '❌ Nonaktif';
        return m.reply(
            `🕌 *ɴᴏᴛɪꜰ sʜᴏʟᴀᴛ*\n\n` +
            `> Status: ${status}\n` +
            `> Lokasi: ${kotaSetting.nama}\n\n` +
            `*Penggunaan:*\n` +
            `\`${m.prefix}notifsholat on\` - Aktifkan\n` +
            `\`${m.prefix}notifsholat off\` - Nonaktifkan`
        );
    }

    if (args === 'on') {
        group.notifSholat = true;
        db.setGroup(m.chat, group);
        return m.reply(`✅ *ɴᴏᴛɪꜰ sʜᴏʟᴀᴛ ᴅɪᴀᴋᴛɪꜰᴋᴀɴ*\n\n> Grup ini akan menerima pengingat waktu sholat\n> Lokasi: ${kotaSetting.nama}`);
    }

    if (args === 'off') {
        group.notifSholat = false;
        db.setGroup(m.chat, group);
        return m.reply(`❌ *ɴᴏᴛɪꜰ sʜᴏʟᴀᴛ ᴅɪɴᴏɴᴀᴋᴛɪꜰᴋᴀɴ*`);
    }
}

module.exports = {
    config: pluginConfig,
    handler
};
