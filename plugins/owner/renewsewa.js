const { getDatabase } = require("../../src/lib/database");
const timeHelper = require("../../src/lib/timeHelper");

const pluginConfig = {
  name: "renewsewa",
  alias: ["perpanjangsewa", "extendsewa"],
  category: "owner",
  description: "Perpanjang durasi sewa grup",
  usage: ".renewsewa <link/id grup> <durasi>",
  example: ".renewsewa https://chat.whatsapp.com/xxx 30d",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function parseDurationMs(str) {
  if (["lifetime", "permanent", "forever", "unlimited"].includes(str.toLowerCase())) {
    return Infinity;
  }

  const match = str.match(/^(\d+)([dDmMyYhH])$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    case "m": return value * 30 * 24 * 60 * 60 * 1000;
    case "y": return value * 365 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

function formatDuration(str) {
  if (["lifetime", "permanent", "forever", "unlimited"].includes(str.toLowerCase())) {
    return "Permanent";
  }

  const match = str.match(/^(\d+)([dDmMyYhH])$/);
  if (!match) return str;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const units = { h: "jam", d: "hari", m: "bulan", y: "tahun" };
  return `${value} ${units[unit] || unit}`;
}

async function resolveGroupId(sock, input) {
  if (input.includes("chat.whatsapp.com/")) {
    const inviteCode = input.split("chat.whatsapp.com/")[1]?.split(/[\s?]/)[0];
    if (!inviteCode) return null;
    const metadata = await sock.groupGetInviteInfo(inviteCode);
    if (!metadata?.id) return null;
    return { id: metadata.id, name: metadata.subject || "Unknown" };
  }

  const groupId = input.includes("@g.us") ? input : input + "@g.us";
  return { id: groupId, name: null };
}

async function handler(m, { sock }) {
  const db = getDatabase();

  if (!db.db.data.sewa) {
    db.db.data.sewa = { enabled: false, groups: {} };
    db.db.write();
  }

  const args = m.args;

  if (args.length < 2) {
    return m.reply(
      `📝 *ʀᴇɴᴇᴡ sᴇᴡᴀ*\n\n` +
        `> Format: \`${m.prefix}renewsewa <link/id> <durasi>\`\n\n` +
        `*ꜰᴏʀᴍᴀᴛ ᴅᴜʀᴀsɪ:*\n` +
        `> \`7d\` = 7 hari\n` +
        `> \`1m\` = 1 bulan\n` +
        `> \`1y\` = 1 tahun\n` +
        `> \`lifetime\` = Permanent\n\n` +
        `> Durasi ditambahkan ke sisa waktu yang ada`,
    );
  }

  const input = args[0];
  const durationStr = args[1];
  const durationMs = parseDurationMs(durationStr);

  if (!durationMs) {
    return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Format durasi tidak valid\n> Contoh: \`7d\`, \`1m\`, \`1y\`, \`lifetime\``);
  }

  m.react("⏳");

  try {
    const result = await resolveGroupId(sock, input);
    if (!result) {
      m.react("❌");
      return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Grup tidak ditemukan`);
    }

    const { id: groupId } = result;
    const existing = db.db.data.sewa.groups[groupId];

    if (!existing) {
      m.react("❌");
      return m.reply(
        `❌ *ɢᴀɢᴀʟ*\n\n> Grup tidak terdaftar dalam sistem sewa\n> Gunakan \`${m.prefix}addsewa\` untuk menambahkan`,
      );
    }

    if (durationMs === Infinity) {
      existing.expiredAt = 0;
      existing.isLifetime = true;
    } else {
      if (existing.isLifetime) {
        m.react("❌");
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Grup ini sudah berstatus Permanent`);
      }

      const baseTime = existing.expiredAt > Date.now() ? existing.expiredAt : Date.now();
      existing.expiredAt = baseTime + durationMs;
      existing.isLifetime = false;
    }

    existing.renewedAt = Date.now();
    existing.renewedBy = m.sender;
    db.db.write();

    const groupName = existing.name || groupId.split("@")[0];
    const expiredStr = existing.isLifetime
      ? "Permanent"
      : timeHelper.fromTimestamp(existing.expiredAt, "D MMMM YYYY HH:mm");

    m.react("✅");
    return m.reply(
      `✅ *sᴇᴡᴀ ᴅɪᴘᴇʀᴘᴀɴᴊᴀɴɢ*\n\n` +
        `> 📝 Grup: \`${groupName}\`\n` +
        `> ➕ Tambahan: \`${formatDuration(durationStr)}\`\n` +
        `> 📅 Expired baru: \`${expiredStr}\``,
    );
  } catch (error) {
    m.react("❌");
    m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${error.message}`);
  }
}

module.exports = {
  config: pluginConfig,
  handler,
};
