const { getDatabase } = require("../../src/lib/database");

const pluginConfig = {
  name: "delsewa",
  alias: ["sewadel", "hapussewa", "removesewa"],
  category: "owner",
  description: "Hapus grup dari whitelist sewa",
  usage: ".delsewa <link/id grup>",
  example: ".delsewa https://chat.whatsapp.com/xxx",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function resolveGroupId(sock, input) {
  if (input.includes("chat.whatsapp.com/")) {
    const inviteCode = input.split("chat.whatsapp.com/")[1]?.split(/[\s?]/)[0];
    try {
      const metadata = await sock.groupGetInviteInfo(inviteCode);
      if (metadata?.id) return { id: metadata.id, name: metadata.subject };
    } catch {}
    return null;
  }

  return { id: input.includes("@g.us") ? input : input + "@g.us", name: null };
}

async function handler(m, { sock }) {
  const db = getDatabase();
  const input = m.text?.trim();

  if (!db.db.data.sewa) {
    db.db.data.sewa = { enabled: false, groups: {} };
    db.db.write();
  }

  let groupId = null;
  let groupName = null;

  if (!input) {
    if (!m.isGroup) {
      return m.reply(
        `📝 *ᴅᴇʟ sᴇᴡᴀ*\n\n` +
          `> Dari private: \`${m.prefix}delsewa <link/id grup>\`\n` +
          `> Dari grup: ketik \`${m.prefix}delsewa\` di grup`,
      );
    }
    groupId = m.chat;
  } else {
    const result = await resolveGroupId(sock, input);
    if (!result) {
      return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Link tidak valid atau grup tidak ditemukan`);
    }
    groupId = result.id;
    groupName = result.name;
  }

  if (!groupId) {
    return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Tidak dapat menentukan grup`);
  }

  const sewaData = db.db.data.sewa.groups[groupId];
  if (!sewaData) {
    return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Grup tidak terdaftar dalam sistem sewa`);
  }

  groupName = groupName || sewaData.name || groupId.split("@")[0];

  delete db.db.data.sewa.groups[groupId];
  db.db.write();

  m.react("✅");
  await m.reply(
    `✅ *sᴇᴡᴀ ᴅɪʜᴀᴘᴜs*\n\n` +
      `> 📝 Grup: \`${groupName}\`\n` +
      `> 🆔 ID: \`${groupId.split("@")[0]}\``,
  );

  if (db.db.data.sewa.enabled) {
    try {
      await sock.sendMessage(groupId, {
        text:
          `⛔ *sᴇᴡᴀʙᴏᴛ*\n\n` +
          `> Grup ini telah dihapus dari whitelist sewa.\n` +
          `> Bot akan meninggalkan grup ini.\n\n` +
          `_Hubungi owner untuk sewa ulang._`,
      });
      await new Promise((r) => setTimeout(r, 2000));
      await sock.groupLeave(groupId);
    } catch {}
  }
}

module.exports = {
  config: pluginConfig,
  handler,
};
