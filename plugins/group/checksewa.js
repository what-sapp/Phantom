const { getDatabase } = require("../../src/lib/database");
const timeHelper = require("../../src/lib/timeHelper");

const pluginConfig = {
  name: "checksewa",
  alias: ["ceksewa", "sisasewa"],
  category: "group",
  description: "Cek sisa waktu sewa bot di grup ini",
  usage: ".checksewa",
  example: ".checksewa",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  isAdmin: true,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

function formatCountdown(expiredAt) {
  const diff = expiredAt - Date.now();
  if (diff <= 0) return { text: "EXPIRED", expired: true };

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  let text = "";
  if (days > 0) text += `${days} hari `;
  if (hours > 0) text += `${hours} jam `;
  if (minutes > 0 && days === 0) text += `${minutes} menit`;

  return { text: text.trim(), expired: false };
}

async function handler(m) {
  const db = getDatabase();

  if (!db.db.data.sewa) {
    db.db.data.sewa = { enabled: false, groups: {} };
    db.db.write();
  }

  if (!db.db.data.sewa.enabled) {
    return m.reply(`ℹ️ *ɪɴꜰᴏ*\n\n> Sistem sewa tidak aktif`);
  }

  const sewaData = db.db.data.sewa.groups[m.chat];

  if (!sewaData) {
    return m.reply(
      `❌ *ᴛɪᴅᴀᴋ ᴛᴇʀᴅᴀꜰᴛᴀʀ*\n\n> Grup ini tidak terdaftar dalam sistem sewa\n> Hubungi owner untuk sewa bot`,
    );
  }

  if (sewaData.isLifetime) {
    m.react("♾️");
    return m.reply(
      `♾️ *sᴛᴀᴛᴜs sᴇᴡᴀ*\n\n` +
        `> 📝 Grup: \`${sewaData.name || m.chat.split("@")[0]}\`\n` +
        `> ⏱️ Status: \`Permanent\``,
    );
  }

  const countdown = formatCountdown(sewaData.expiredAt);
  const expiredStr = timeHelper.fromTimestamp(sewaData.expiredAt, "D MMMM YYYY HH:mm");

  if (countdown.expired) {
    return m.reply(
      `❌ *sᴇᴡᴀ ᴇxᴘɪʀᴇᴅ*\n\n` +
        `> Masa sewa sudah habis\n` +
        `> Berakhir: \`${expiredStr}\`\n\n` +
        `_Hubungi owner untuk perpanjang_`,
    );
  }

  m.react("⏱️");
  return m.reply(
    `⏱️ *sɪsᴀ sᴇᴡᴀ*\n\n` +
      `> 📝 Grup: \`${sewaData.name || m.chat.split("@")[0]}\`\n` +
      `> ⏱️ Sisa: \`${countdown.text}\`\n` +
      `> 📅 Berakhir: \`${expiredStr}\``,
  );
}

module.exports = {
  config: pluginConfig,
  handler,
};
