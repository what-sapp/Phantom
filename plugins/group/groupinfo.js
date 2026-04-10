const {
  getParticipantJid,
  resolveAnyLidToJid,
} = require("../../src/lib/lidHelper");
const timeHelper = require("../../src/lib/timeHelper");

const pluginConfig = {
  name: "groupinfo",
  alias: ["infogroup", "gcinfo", "infogc", "gc"],
  category: "group",
  description: "Menampilkan informasi lengkap grup",
  usage: ".groupinfo",
  example: ".groupinfo",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
  isAdmin: false,
  isBotAdmin: false,
};

async function handler(m, { sock, db }) {
  try {
    const groupMeta = m.groupMetadata;
    const participants = groupMeta.participants || [];
    const admins = participants.filter((p) => p.admin);
    let ownerJid = null;
    if (groupMeta.owner) {
      ownerJid = resolveAnyLidToJid(groupMeta.owner, participants);
    }
    if (!ownerJid || ownerJid.includes("@lid")) {
      const superAdmin = participants.find((p) => p.admin === "superadmin");
      if (superAdmin) {
        ownerJid = getParticipantJid(superAdmin);
      }
    }
    if (!ownerJid || ownerJid.includes("@lid")) {
      const firstAdmin = admins[0];
      if (firstAdmin) {
        ownerJid = getParticipantJid(firstAdmin);
      }
    }

    const group = db.getGroup(m.chat) || {};

    const createdDate = groupMeta.creation
      ? timeHelper.fromTimestamp(groupMeta.creation * 1000, "D MMMM YYYY")
      : "Unknown";

    const features = [];
    if (group.welcome === true || group.welcome === "on")
      features.push("✅ Welcome");
    else features.push("❌ Welcome");
    if (group.goodbye === true || group.goodbye === "on")
      features.push("✅ Goodbye");
    else features.push("❌ Goodbye");
    if (group.antilink === "on") features.push("✅ AntiLink");
    else features.push("❌ AntiLink");
    if (group.antitagsw === "on") features.push("✅ AntiTagSW");
    else features.push("❌ AntiTagSW");
    if (group.antiremove === "on") features.push("✅ AntiRemove");
    else features.push("❌ AntiRemove");

    // Get owner number for display
    const ownerNumber = ownerJid ? ownerJid.split("@")[0] : null;
    const ownerDisplay =
      ownerNumber && !ownerNumber.includes(":")
        ? `@${ownerNumber}`
        : "Tidak diketahui";

    const infoText =
      `📊 *ɢʀᴏᴜᴘ ɪɴꜰᴏ*\n\n` +
      `> *Nama:* ${groupMeta.subject}\n` +
      `> *ID:* ${m.chat}\n` +
      `> *Owner:* ${ownerDisplay}\n` +
      `> *Dibuat:* ${createdDate}\n\n` +
      `\`\`\`━━━ ᴍᴇᴍʙᴇʀ ━━━\`\`\`\n` +
      `> 👥 Total: ${participants.length}\n` +
      `> 👑 Admin: ${admins.length}\n` +
      `> 👤 Member: ${participants.length - admins.length}\n\n` +
      `\`\`\`━━━ ꜰᴇᴀᴛᴜʀᴇs ━━━\`\`\`\n` +
      features.map((f) => `> ${f}`).join("\n") +
      (groupMeta.desc
        ? `\n\n\`\`\`━━━ ᴅᴇsᴋʀɪᴘsɪ ━━━\`\`\`\n> ${groupMeta.desc}`
        : "");

    await sock.sendMessage(
      m.chat,
      {
        text: infoText,
        mentions: ownerJid && !ownerJid.includes(":") ? [ownerJid] : [],
      },
      { quoted: m },
    );
  } catch (error) {
    await m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> ${error.message}`);
  }
}

module.exports = {
  config: pluginConfig,
  handler,
};
