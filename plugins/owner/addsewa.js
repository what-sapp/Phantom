const { getDatabase } = require("../../src/lib/database");
const timeHelper = require("../../src/lib/timeHelper");

const pluginConfig = {
  name: "addsewa",
  alias: ["sewaadd", "tambahsewa"],
  category: "owner",
  description: "Whitelist grup untuk sewa bot",
  usage: ".addsewa <link/id grup> <durasi>",
  example: ".addsewa https://chat.whatsapp.com/xxx 30d",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function parseDuration(str) {
  if (["lifetime", "permanent", "forever", "unlimited"].includes(str.toLowerCase())) {
    return Infinity;
  }

  const match = str.match(/^(\d+)([dDmMyYhH])$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  let ms = 0;

  switch (unit) {
    case "h":
      ms = value * 60 * 60 * 1000;
      break;
    case "d":
      ms = value * 24 * 60 * 60 * 1000;
      break;
    case "m":
      ms = value * 30 * 24 * 60 * 60 * 1000;
      break;
    case "y":
      ms = value * 365 * 24 * 60 * 60 * 1000;
      break;
    default:
      return null;
  }

  return Date.now() + ms;
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
  try {
    const metadata = await sock.groupMetadata(groupId);
    return { id: groupId, name: metadata?.subject || "Unknown" };
  } catch {
    return { id: groupId, name: "Unknown" };
  }
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
      `📝 *ᴀᴅᴅ sᴇᴡᴀ*\n\n` +
        `> Format: \`${m.prefix}addsewa <link/id> <durasi>\`\n\n` +
        `*ꜰᴏʀᴍᴀᴛ ᴅᴜʀᴀsɪ:*\n` +
        `> \`7d\` = 7 hari\n` +
        `> \`1m\` = 1 bulan\n` +
        `> \`1y\` = 1 tahun\n` +
        `> \`lifetime\` = Permanent\n\n` +
        `*ɪɴᴘᴜᴛ ɢʀᴜᴘ:*\n` +
        `> Link: \`https://chat.whatsapp.com/xxx\`\n` +
        `> ID: \`120363xxx@g.us\`\n\n` +
        `*ᴄᴏɴᴛᴏʜ:*\n` +
        `> \`${m.prefix}addsewa https://chat.whatsapp.com/xxx 30d\`\n` +
        `> \`${m.prefix}addsewa 120363xxx 1m\``,
    );
  }

  const input = args[0];
  const durationStr = args[1];
  const expiredAt = parseDuration(durationStr);

  if (!expiredAt) {
    return m.reply(
      `❌ *ɢᴀɢᴀʟ*\n\n> Format durasi tidak valid\n> Contoh: \`7d\`, \`1m\`, \`1y\`, \`lifetime\``,
    );
  }

  m.react("⏳");

  try {
    const result = await resolveGroupId(sock, input);
    if (!result) {
      m.react("❌");
      return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Grup tidak ditemukan atau link tidak valid`);
    }

    const { id: groupId, name: groupName } = result;
    const isLifetime = expiredAt === Infinity;

    db.db.data.sewa.groups[groupId] = {
      name: groupName,
      addedAt: Date.now(),
      expiredAt: isLifetime ? 0 : expiredAt,
      isLifetime,
      addedBy: m.sender,
    };
    db.db.write();

    const expiredStr = isLifetime
      ? "Permanent"
      : timeHelper.fromTimestamp(expiredAt, "D MMMM YYYY HH:mm");

    m.react("✅");
    return m.reply(
      `✅ *sᴇᴡᴀ ᴅɪᴛᴀᴍʙᴀʜ*\n\n` +
        `> 📝 Grup: \`${groupName}\`\n` +
        `> 🆔 ID: \`${groupId.split("@")[0]}\`\n` +
        `> ⏱️ Durasi: \`${formatDuration(durationStr)}\`\n` +
        `> 📅 Expired: \`${expiredStr}\``,
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
