const { getDatabase } = require("../../src/lib/database");
const timeHelper = require("../../src/lib/timeHelper");

const pluginConfig = {
  name: "listsewa",
  alias: ["sewalist", "daftarsewa"],
  category: "owner",
  description: "Lihat daftar grup yang terdaftar sewa",
  usage: ".listsewa",
  example: ".listsewa",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function formatCountdown(data) {
  if (data.isLifetime) return "♾️ Permanent";

  const diff = data.expiredAt - Date.now();
  if (diff <= 0) return "❌ Expired";

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getStatusEmoji(data) {
  if (data.isLifetime) return "♾️";
  const diff = data.expiredAt - Date.now();
  if (diff <= 0) return "❌";
  if (diff <= 3 * 24 * 60 * 60 * 1000) return "⚠️";
  return "✅";
}

async function handler(m) {
  const db = getDatabase();

  if (!db.db.data.sewa) {
    db.db.data.sewa = { enabled: false, groups: {} };
    db.db.write();
  }

  const sewaGroups = db.db.data.sewa.groups || {};
  const groupIds = Object.keys(sewaGroups);

  if (groupIds.length === 0) {
    return m.reply(
      `📋 *ʟɪsᴛ sᴇᴡᴀ*\n\n` +
        `> Status: *${db.db.data.sewa.enabled ? "AKTIF" : "NONAKTIF"}*\n` +
        `> Tidak ada grup terdaftar\n\n` +
        `> Tambah: \`${m.prefix}addsewa <link> <durasi>\``,
    );
  }

  const sorted = groupIds.sort((a, b) => {
    const aData = sewaGroups[a];
    const bData = sewaGroups[b];
    if (aData.isLifetime && !bData.isLifetime) return 1;
    if (!aData.isLifetime && bData.isLifetime) return -1;
    return (aData.expiredAt || 0) - (bData.expiredAt || 0);
  });

  let list = `📋 *ʟɪsᴛ sᴇᴡᴀ*\n\n`;
  list += `> Status: *${db.db.data.sewa.enabled ? "AKTIF" : "NONAKTIF"}*\n`;
  list += `> Total: *${groupIds.length}* grup\n\n`;

  for (let i = 0; i < sorted.length; i++) {
    const gid = sorted[i];
    const data = sewaGroups[gid];
    const status = getStatusEmoji(data);
    const countdown = formatCountdown(data);

    list += `${status} *${i + 1}. ${data.name || "Unknown"}*\n`;
    list += `> 🆔 \`${gid.split("@")[0]}\`\n`;
    list += `> ⏱️ ${countdown}\n\n`;
  }

  return m.reply(list);
}

module.exports = {
  config: pluginConfig,
  handler,
};
