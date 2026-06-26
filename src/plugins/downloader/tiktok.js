export default {
	name: "tiktok",
	description: "Downloader TikTok.",
	command: ["tt", "tiktok"],
	usage: "$prefix$command https://vt.tiktok.com/ZSkSAodxb/",
	permissions: "all",
	hidden: false,
	failed: "Failed to execute %command: %error",
	wait: null,
	category: "downloader",
	cooldown: 5,
	limit: true,
	react: true,
	botAdmin: false,
	group: false,
	private: false,
	owner: false,

	execute: async (m) => {
		const input =
			m.text && m.text.trim() !== ""
				? m.text
				: m.quoted && m.quoted.url
					? m.quoted.url
					: null;

		if (!input) {
			return m.reply("Input URL TikTok.");
		}

		const response = await fetch(
			`https://phantom-api.us.ci/api/download/tiktok?url=${encodeURIComponent(input)}`
		);

		const data = await response.json();

		if (!data?.success) {
			return m.reply(data?.message || "Download failed.");
		}

		const { username, caption, video, music, images, type } = data.result;

		let msg = "*🕺 TIKTOK DOWNLOADER*\n\n";
		msg += `*👤 User*: ${username}\n`;
		msg += `*📝 Caption*: ${caption || "-"}\n`;

		if (images?.length > 0) {
			for (const img of images) {
				await m.reply({ image: { url: img } });
			}
		}

		await m.reply({
			video: { url: video },
			caption: msg.trim(),
		});

		await m.reply({
			audio: { url: music },
			mimetype: "audio/mpeg",
		});
	},
};