import packageJson from "../../../package.json" assert { type: "json" };

export default {
    name: "menu",
    description: "Show bot menu",
    command: ["menu"],
    permissions: "all",
    hidden: false,
    category: "info",
    cooldown: 5,
    usage: "$prefix$command",
    react: true,
    execute: async (m, { plugins, isOwner, sock }) => {
        const botname = process.env.BOT_NAME || "Katsumi";
        const version = packageJson.version;
        
        const uptimeSeconds = process.uptime();
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptime = `${days}d ${hours}h ${minutes}m`;
        
        const now = new Date();
        const time = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        const day = now.toLocaleDateString("id-ID", { weekday: "long" });
        const date = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
        
        const settings = await db.SettingsModel.getSettings();
        let mode = "public";
        if (settings.self) mode = "self";
        else if (settings.groupOnly) mode = "group only";
        else if (settings.privateChatOnly) mode = "private only";
        
        const visiblePlugins = plugins.filter(p => !p.hidden && (!p.owner || isOwner));
        const totalPlugins = visiblePlugins.length;
        
        const categories = {};
        for (const plugin of visiblePlugins) {
            const cat = plugin.category || "general";
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(plugin);
        }
        
        const prefix = m.prefix;
        let menu = `╭═══ ${botname.toUpperCase()} ═══⊷\n`;
        menu += `╭────────────\n`;
        menu += `┃々│ Prefix : ${prefix}\n`;
        menu += `┃々│ User : @${m.sender.replace(/[^0-9]/g, "")}\n`;
        menu += `┃々│ Time : ${time}\n`;
        menu += `┃々│ Day : ${day}\n`;
        menu += `┃々│ Date : ${date}\n`;
        menu += `┃々│ Version : ${version}\n`;
        menu += `┃々│ Plugins : ${totalPlugins}\n`;
        menu += `┃々│ Uptime : ${uptime}\n`;
        menu += `┃々│ mode : ${mode}\n`;
        menu += `┃  ╰────────────\n`;
        menu += `╰═════════════════⊷\n\n`;
        
        // Add categories
        const sortedCategories = Object.keys(categories).sort();
        for (const cat of sortedCategories) {
            const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
            menu += `╭─── ${catName} ───⊷\n`;
            for (const plugin of categories[cat].sort((a, b) => a.command[0].localeCompare(b.command[0]))) {
                menu += `│ ${prefix}${plugin.command[0]}\n`;
            }
            menu += `╰─────────────────⊷\n\n`;
        }
        
        const pp = "https://telegra.ph/file/7c3ed11c5dd1e2a64bd02.jpg";
        const thumbnailUrl = await sock
            .profilePictureUrl(m.sender, "image")
            .catch(() => pp);
        
        await m.reply({
            text: menu,
            contextInfo: {
                externalAdReply: {
                    title: "",
                    body: "@natsumiworld",
                    renderLargerThumbnail: true,
                    sourceUrl: "https://whatsapp.com/channel/0029Va8b0s8G3R3jDBfpja0a",
                    mediaType: 1,
                    thumbnailUrl,
                },
                mentionedJid: [m.sender],
            },
        });
    },
};