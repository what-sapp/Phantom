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
    name: 'tebakkimia',
    alias: ['kimia', 'chemistry', 'unsur'],
    category: 'game',
    description: 'Tebak lambang unsur kimia',
    usage: '.tebakkimia',
    example: '.tebakkimia',
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
        if (session && session.gameType === 'tebakkimia') {
            const remaining = getRemainingTime(chatId);
            let text = `⚠️ *ᴍᴀsɪʜ ᴀᴅᴀ ɢᴀᴍᴇ*\n\n`;
            text += `> 🧪 Unsur: *${session.question.unsur}*\n`;
            text += `> 💡 Hint: *${getHint(session.question.lambang, 1)}*\n`;
            text += `> ⏱️ Sisa: *${formatRemainingTime(remaining)}*\n\n`;
            text += `_Reply pesan soal untuk menjawab atau ketik "nyerah"_`;
            await m.reply(text);
            return;
        }
    }
    
    const question = getRandomItem('tebakkimia.json');
    if (!question) {
        await m.reply('❌ *ᴅᴀᴛᴀ ᴛɪᴅᴀᴋ ᴛᴇʀsᴇᴅɪᴀ*\n\n> Data game tidak tersedia!');
        return;
    }
    
    let text = `🧪 *ᴛᴇʙᴀᴋ ᴋɪᴍɪᴀ*\n\n`;
    text += `> 🔬 Apa lambang unsur *${question.unsur}*?\n`;
    text += `> 💡 Hint: *${getHint(question.lambang, 1)}*\n`;
    text += `> ⏱️ Waktu: *45 detik*\n`;
    text += `> 🎁 Hadiah: *+${GAME_REWARD.limit} Limit, +${GAME_REWARD.exp} EXP*\n\n`;
    text += `_Reply pesan ini dengan jawabanmu atau ketik "nyerah"_`;
    
    const sentMsg = await sock.sendMessage(chatId, { text, contextInfo: getGameContextInfo('🧪 TEBAK KIMIA', 'Tebak unsur!') }, { quoted: m });
    
    createSession(chatId, 'tebakkimia', question, sentMsg.key, 45000);
    
    setSessionTimer(chatId, async () => {
        let timeoutText = `⏱️ *ᴡᴀᴋᴛᴜ ʜᴀʙɪs!*\n\n`;
        timeoutText += `> Jawaban: *${question.lambang}*\n\n`;
        timeoutText += `_Tidak ada yang berhasil menjawab_`;
        await sock.sendMessage(chatId, { text: timeoutText, contextInfo: getGameContextInfo() });
    });
}

async function answerHandler(m, sock) {
    const chatId = m.chat;
    const session = getSession(chatId);
    
    if (!session || session.gameType !== 'tebakkimia') return false;
    
    const userAnswer = m.text || m.body || '';
    if (!userAnswer || userAnswer.startsWith('.')) return false;
    
    if (isSurrender(userAnswer)) {
        endSession(chatId);
        let text = `🏳️ *ᴍᴇɴʏᴇʀᴀʜ!*\n\n`;
        text += `> Unsur: *${session.question.unsur}*\n`;
        text += `> Jawaban: *${session.question.lambang}*\n\n`;
        text += `_@${m.sender.split('@')[0]} menyerah_`;
        await m.reply(text, { mentions: [m.sender] });
        return true;
    }
    
    if (!isReplyToGame(m, session)) {
        return false;
    }
    
    session.attempts++;
    
    const result = checkAnswerAdvanced(session.question.lambang, userAnswer);
    
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
        
        let text = `🎉 *ʙᴇɴᴀʀ!*\n\n`;
        text += `> Unsur: *${session.question.unsur}*\n`;
        text += `> Jawaban: *${session.question.lambang}*\n`;
        text += `> Pemenang: *@${m.sender.split('@')[0]}*\n\n`;
        text += `╭┈┈⬡「 🎁 *ʜᴀᴅɪᴀʜ* 」\n`;
        text += `┃ 📊 +${totalLimit} Limit\n`;
        text += `┃ 💰 +${totalBalance} Koin\n`;
        text += `┃ ⭐ +${totalExp} EXP\n`;
        text += `╰┈┈┈┈┈┈┈┈⬡`;
        text += bonusText;
        
        await sock.sendMessage(chatId, {
            text: text,
            mentions: [m.sender],
            contextInfo: getWinnerContextInfo('🏆 WINNER!', `Selamat @${m.sender.split('@')[0]}!`)
        }, { quoted: m });
        return true;
    }
    
    if (result.status === 'close') {
        const remaining = getRemainingTime(chatId);
        const percent = Math.round(result.similarity * 100);
        await m.reply(`🔥 *ʜᴀᴍᴘɪʀ!* Jawabanmu *${percent}%* mirip!\n> _Sisa waktu: *${formatRemainingTime(remaining)}*_`);
        return false;
    }
    
    const remaining = getRemainingTime(chatId);
    if (remaining > 0 && session.attempts < 10) {
        await m.reply(`❌ *sᴀʟᴀʜ!* _Sisa waktu: *${formatRemainingTime(remaining)}*_`);
    }
    
    return false;
}

module.exports = {
    config: pluginConfig,
    handler,
    answerHandler
};
