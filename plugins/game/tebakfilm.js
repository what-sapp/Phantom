const {
    getRandomItem, createSession, getSession, endSession,
    checkAnswerAdvanced, getHint, hasActiveSession, setSessionTimer,
    getRemainingTime, formatRemainingTime, isSurrender, isReplyToGame,
    GAME_REWARD
} = require('../../src/lib/gameData');
const { getDatabase } = require('../../src/lib/database');
const { addExpWithLevelCheck } = require('../../src/lib/levelHelper');
const { getGameContextInfo, getWinnerContextInfo, checkFastAnswer } = require('../../src/lib/contextHelper');

const pluginConfig = {
    name: 'tebakfilm',
    alias: ['tf', 'guessmovie'],
    category: 'game',
    description: 'Tebak film dari sinopsis singkat',
    usage: '.tebakfilm',
    example: '.tebakfilm',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

async function handler(m, { sock }) {
    const chatId = m.chat;

    if (hasActiveSession(chatId)) {
        const session = getSession(chatId);
        if (session && session.gameType === 'tebakfilm') {
            const remaining = getRemainingTime(chatId);
            let text = `⚠️ *ᴍᴀsɪʜ ᴀᴅᴀ ɢᴀᴍᴇ*\n\n\`\`\`${session.question.soal}\`\`\`\n\n> 💡 Hint: *${getHint(session.question.jawaban, 2)}*\n> ⏱️ Sisa: *${formatRemainingTime(remaining)}*\n\n_Reply pesan soal untuk menjawab atau ketik "nyerah"_`;
            await m.reply(text);
            return;
        }
    }

    const question = getRandomItem('tebakfilm.json');
    if (!question) {
        await m.reply('❌ *ᴅᴀᴛᴀ ᴛɪᴅᴀᴋ ᴛᴇʀsᴇᴅɪᴀ*\n\n> Data game tidak tersedia!');
        return;
    }

    let text = `🎬 *ᴛᴇʙᴀᴋ ꜰɪʟᴍ*\n\n\`\`\`${question.soal}\`\`\`\n\n> 💡 Hint: *${getHint(question.jawaban, 2)}*\n> ⏱️ Waktu: *60 detik*\n> 🎁 Hadiah: *+${GAME_REWARD.limit} Limit, +${GAME_REWARD.koin} Bal, +${GAME_REWARD.exp} EXP*\n\n_Reply pesan ini dengan jawabanmu atau ketik "nyerah"_`;

    const sentMsg = await sock.sendMessage(chatId, { text, contextInfo: getGameContextInfo('🎬 TEBAK FILM', 'Tebak film dari sinopsis!') }, { quoted: m });
    createSession(chatId, 'tebakfilm', question, sentMsg.key, 60000);

    setSessionTimer(chatId, async () => {
        await sock.sendMessage(chatId, { text: `⏱️ *ᴡᴀᴋᴛᴜ ʜᴀʙɪs!*\n\n> Jawaban: *${question.jawaban}*\n\n_Tidak ada yang berhasil menjawab_`, contextInfo: getGameContextInfo() });
    });
}

async function answerHandler(m, sock) {
    const chatId = m.chat;
    const session = getSession(chatId);
    if (!session || session.gameType !== 'tebakfilm') return false;

    const userAnswer = m.text || m.body || '';
    if (!userAnswer || userAnswer.startsWith('.')) return false;

    if (isSurrender(userAnswer)) {
        endSession(chatId);
        await m.reply(`🏳️ *ᴍᴇɴʏᴇʀᴀʜ!*\n\n> Jawaban: *${session.question.jawaban}*\n\n_@${m.sender.split('@')[0]} menyerah_`, { mentions: [m.sender] });
        return true;
    }

    if (!isReplyToGame(m, session)) return false;
    session.attempts++;

    const result = checkAnswerAdvanced(session.question.jawaban, userAnswer);

    if (result.status === 'correct') {
        endSession(chatId);
        const db = getDatabase();
        const user = db.getUser(m.sender);

        let totalLimit = GAME_REWARD.limit;
        let totalBalance = GAME_REWARD.koin;
        let totalExp = GAME_REWARD.exp;
        let bonusText = '';

        const fastResult = checkFastAnswer(session);
        if (fastResult.isFast) {
            totalLimit += fastResult.bonus.limit;
            totalBalance += fastResult.bonus.koin;
            totalExp += fastResult.bonus.exp;
            bonusText = `\n\n${fastResult.praise}\n> ⚡ *BONUS KILAT:* +${fastResult.bonus.limit} Limit, +${fastResult.bonus.koin} Koin\n> ⏱️ Waktu: *${(fastResult.elapsed / 1000).toFixed(1)}s*`;
        }

        db.updateEnergi(m.sender, totalLimit);
        db.updateKoin(m.sender, totalBalance);
        if (!user.rpg) user.rpg = {};
        await addExpWithLevelCheck(sock, m, db, user, totalExp);
        db.save();

        let text = `🎉 *ʙᴇɴᴀʀ!*\n\n> Jawaban: *${session.question.jawaban}*\n> Pemenang: *@${m.sender.split('@')[0]}*\n> Percobaan: *${session.attempts}x*\n\n`;
        text += `╭┈┈⬡「 🎁 *ʜᴀᴅɪᴀʜ* 」\n┃ 📊 +${totalLimit} Limit\n┃ 💰 +${totalBalance} Koin\n┃ ⭐ +${totalExp} EXP\n╰┈┈┈┈┈┈┈┈⬡`;
        text += bonusText;

        await sock.sendMessage(chatId, { text, mentions: [m.sender], contextInfo: getWinnerContextInfo('🏆 WINNER!', `Selamat @${m.sender.split('@')[0]}!`) }, { quoted: m });
        return true;
    }

    if (result.status === 'close') {
        const remaining = getRemainingTime(chatId);
        await m.reply(`🔥 *ʜᴀᴍᴘɪʀ!* Jawabanmu *${Math.round(result.similarity * 100)}%* mirip!\n> _Sisa waktu: *${formatRemainingTime(remaining)}*_`);
        return false;
    }

    const remaining = getRemainingTime(chatId);
    if (remaining > 0 && session.attempts < 10) {
        await m.reply(`❌ *sᴀʟᴀʜ!* _Sisa waktu: *${formatRemainingTime(remaining)}*_`);
    }
    return false;
}

module.exports = { config: pluginConfig, handler, answerHandler };
