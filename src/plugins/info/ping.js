// src/plugins/info/ping.js
export default {
    name: "ping",
    description: "Check bot ping",
    command: ["ping", "pong"],
    permissions: "all",
    hidden: false,
    category: "info",
    cooldown: 3,
    usage: "$prefix$command",
    react: true,
    execute: async (m, { sock }) => {
        const start = Date.now();
        const ping = Date.now() - start;
        
        await sock.sendMessage(m.from, {
            text: `🏓 Pong!\n\n⏱️ Ping: *${ping}ms*`,
            footer: "Click button for runtime",
            buttons: [
                { text: "⏱️ Runtime", id: "runtime" }
            ]
        }, {
            quoted: m
        });
    }
};