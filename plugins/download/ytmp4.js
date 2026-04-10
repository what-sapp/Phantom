const axios = require('axios')
const config = require('../../config')
const { wrapper } = require('axios-cookiejar-support')
const { CookieJar } = require('tough-cookie')
const NEOXR_APIKEY = config.APIkey?.neoxr || 'Milik-Bot-OurinMD'
const { exec } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
const execAsync = promisify(exec)

const pluginConfig = {
    name: 'ytmp4',
    alias: ['youtubemp4', 'ytvideo'],
    category: 'download',
    description: 'Download video YouTube',
    usage: '.ytmp4 <url>',
    example: '.ytmp4 https://youtube.com/watch?v=xxx',
    cooldown: 20,
    energi: 2,
    isEnabled: true
}

const H = {
  html: {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36"
  },
  api: {
    "accept": "*/*",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "origin": "https://v1.ytmp3.ai",
    "referer": "https://v1.ytmp3.ai/",
    "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36"
  }
};

async function ytmp3(youtubeURL, format = "mp3") {
  const ts = () => Math.floor(Date.now() / 1000);

  const vid = (() => {
    if (youtubeURL.includes("youtu.be/")) return /\/([a-zA-Z0-9_-]{11})/.exec(youtubeURL)?.[1];
    if (youtubeURL.includes("youtube.com")) {
      if (youtubeURL.includes("/live/") || youtubeURL.includes("/shorts/"))
        return /\/([a-zA-Z0-9_-]{11})/.exec(youtubeURL)?.[1];
      return /v=([a-zA-Z0-9_-]{11})/.exec(youtubeURL)?.[1];
    }
  })();
  if (!vid) return { error: "Invalid YouTube URL" };

  const html = await (await fetch("https://v1.ytmp3.ai/", { headers: H.html })).text();
  const json = JSON.parse(/var json = JSON\.parse\('(.+?)'\)/.exec(html)?.[1]);

  let token = "";
  for (let i = 0; i < json[0].length; i++)
    token += String.fromCharCode(json[0][i] - json[2][json[2].length - (i + 1)]);
  if (json[1]) token = token.split("").reverse().join("");
  if (token.length > 32) token = token.substring(0, 32);

  const initRes = await (await fetch(
    "https://epsilon.epsiloncloud.org/api/v1/init?" + String.fromCharCode(json[6]) + "=" + encodeURIComponent(token) + "&t=" + ts(),
    { headers: H.api }
  )).json();
  if (initRes.error > 0) return { error: `Init failed: ${initRes.error}` };

  let cvtURL = initRes.convertURL;
  if (cvtURL.includes("&v=")) cvtURL = cvtURL.split("&v=")[0];
  const cvtRes = await (await fetch(
    `${cvtURL}&v=${vid}&f=${format}&t=${ts()}`,
    { headers: H.api }
  )).json();
  if (cvtRes.error > 0) return { error: `Convert failed: ${cvtRes.error}` };

  let { progressURL, downloadURL, title } = cvtRes.redirect === 1
    ? await (await fetch(`${cvtRes.redirectURL.split("&v=")[0]}&v=${vid}&f=${format}&t=${ts()}`, { headers: H.api })).json()
    : cvtRes;

  while (true) {
    const prog = await (await fetch(`${progressURL}&t=${ts()}`, { headers: H.api })).json();
    if (prog.error > 0) return { error: `Progress failed: ${prog.error}` };
    if (prog.progress >= 3) break;
    await new Promise(r => setTimeout(r, 3000));
  }

  return { title, format, downloadURL };
}

async function handler(m, { sock }) {
    const url = m.text?.trim()
    if (!url) return m.reply(`Contoh: ${m.prefix}ytmp4 https://youtube.com/watch?v=xxx`)
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) return m.reply('❌ URL harus YouTube')

    m.react('🎬')

    try {
        const audioUrl = await ytmp3(url, 'mp4')

        await sock.sendMessage(m.chat, {
            video: { url: audioUrl.downloadURL },
            mimetype: 'video/mp4',
            caption: `✅ *${audioUrl.title}*`,
            contextInfo: {
                forwardingScore: 9999,
                isForwarded: true,
            }           
        }, { quoted: m })
        m.react('✅')

    } catch (err) {
        console.error('[YTMP4]', err)
        m.react('❌')
        m.reply('Gagal mengunduh video.')
    }
}

module.exports = {
    config: pluginConfig,
    handler
}