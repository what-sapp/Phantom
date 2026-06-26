// src/plugins/info/runtime.js
import packageJson from "../../../package.json" assert { type: "json" };
import os from "os";

export default {
    name: "runtime",
    description: "Show bot runtime information",
    command: ["runtime", "info", "stats"],
    permissions: "all",
    hidden: false,
    category: "info",
    cooldown: 5,
    usage: "$prefix$command",
    react: true,
    execute: async (m, { sock }) => {
        const uptimeSeconds = process.uptime();
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);
        const uptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        
        const memoryUsage = process.memoryUsage();
        const ramUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const ramTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
        const rss = (memoryUsage.rss / 1024 / 1024).toFixed(2);
        
        const cpus = os.cpus();
        const cpuModel = cpus[0]?.model || "Unknown";
        const cpuCores = cpus.length;
        
        await sock.sendMessage(m.from, {
            disclaimerText: '📊 Bot Runtime Information',
            richResponse: [{
                text: '📦 Bot Info',
            }, {
                table: [
                    { isHeading: true, items: ['', 'Value'] },
                    { isHeading: false, items: ['Name', process.env.BOT_NAME || 'Katsumi'] },
                    { isHeading: false, items: ['Version', packageJson.version] },
                    { isHeading: false, items: ['Platform', `${process.platform} (${os.arch()})`] }
                ]
            }, {
                text: '⏱️ Uptime',
            }, {
                table: [
                    { isHeading: true, items: ['', 'Value'] },
                    { isHeading: false, items: ['Uptime', uptime] }
                ]
            }, {
                text: '🖥️ System',
            }, {
                table: [
                    { isHeading: true, items: ['', 'Value'] },
                    { isHeading: false, items: ['CPU', cpuModel] },
                    { isHeading: false, items: ['Cores', String(cpuCores)] },
                    { isHeading: false, items: ['RAM', `${ramUsed} MB / ${ramTotal} MB`] }
                ]
            }, {
                text: '📱 Node.js',
            }, {
                table: [
                    { isHeading: true, items: ['', 'Value'] },
                    { isHeading: false, items: ['Version', process.version] },
                    { isHeading: false, items: ['Memory', `${rss} MB`] }
                ]
            }]
        }, {
            quoted: m
        });
    }
};