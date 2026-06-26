export default {
	name: "play",
	description: "Youtube & Downloader (audio/video)",
	command: ["yt", "youtube", "play"],
	usage: "$prefix$command <query/link> [-video]",
	category: "downloader",
	permissions: "all",
	hidden: false,
	failed: "Failed to execute %command: %error",
	wait: null,
	cooldown: 5,
	limit: true,
	react: true,
	botAdmin: false,
	group: false,
	private: false,
	owner: false,

	execute: async (m, { sock }) => {
		if (!sock.youtube) {
			sock.youtube = {};
		}

		let input =
			m.text && m.text.trim() !== ""
				? m.text
				: m.quoted && m.quoted.text
					? m.quoted.text
					: null;

		const videoFlag = /(?:^|\s)-(video)\b/i;
		let isVideo = videoFlag.test(input);
		if (isVideo) {
			input = input.replace(videoFlag, "").trim();
		}

		const urlMatch = input
			? input.match(
					/(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/\S+/i
				)
			: null;
		const isLink = !!urlMatch;
		const url = urlMatch ? urlMatch[0] : null;

		if (!input) {
			return m.reply("Please provide a YouTube title, link, or query.");
		}

		if (isLink) {
			const format = isVideo ? "mp4" : "mp3";
			const endpoint = isVideo ? "/download/youtube2" : "/download/ytmp4";
			const response = await fetch(
				`https://phantom-api.us.ci/api${endpoint}?url=${encodeURIComponent(url)}&format=${format}`
			);
			const data = await response.json();

			if (!data?.success) {
				return m.reply(data?.message || "Download failed.");
			}

			const { title, download_url, thumbnail } = data.result;

			await m.reply(`⏳ Downloading ${isVideo ? "video" : "audio"}...`);

			const buffer = await fetch(download_url).then(r => Buffer.from(await r.arrayBuffer()));
			const mimetype = isVideo ? "video/mp4" : "audio/mpeg";

			if (isVideo) {
				await m.reply({ video: buffer, mimetype, caption: title });
			} else {
				const thumb = await fetch(thumbnail).then(r => Buffer.from(await r.arrayBuffer()));
				await m.reply({ document: buffer, mimetype, fileName: `${title}.mp3`, thumbnail: thumb, caption: title });
			}
			return;
		}

		const searchRes = await fetch(
			`https://meta-api.zone.id/search/youtube?query=${encodeURIComponent(input)}`
		);
		const searchData = await searchRes.json();

		if (!searchData?.status || !searchData.results?.length) {
			return m.reply("No results found.");
		}

		const listMsg = searchData.results
			.map(
				(v, i) =>
					`*${i + 1}.* *${v.title}*\n` +
					`Views: ${v.views}\n` +
					`Duration: ${v.duration}\n`
			)
			.join("\n");

		const sent = await m.reply(
			"*YouTube Search*\n\n" +
				`Query: _${input}_\n\n` +
				"Reply with:\n" +
				"`1` - Audio\n" +
				"`2` - Video\n\n" +
				"*Results:*\n" +
				`${listMsg}`.trim()
		);

		sock.youtube[m.sender] = {
			results: searchData.results,
			messageId: sent.key.id,
		};

		setTimeout(() => {
			if (sock.youtube[m.sender]?.messageId === sent.key.id) {
				delete sock.youtube[m.sender];
			}
		}, 90000);
	},

	after: async (m, { sock }) => {
		const session = sock.youtube?.[m.sender];
		if (!session || !m.quoted || m.quoted.id !== session.messageId) {
			return;
		}

		const { results } = session;
		const idx = parseInt(m.body.trim());
		if (isNaN(idx) || idx < 1 || idx > results.length) {
			m.reply("Invalid number.");
			delete sock.youtube[m.sender];
			return;
		}

		const formatChoice = m.quoted?.text?.includes("Reply with") ? m.body.trim() : "1";
		const isVideo = formatChoice === "2";

		const chosen = results[idx - 1];
		const format = isVideo ? "mp4" : "mp3";
		const endpoint = isVideo ? "/download/youtube2" : "/download/ytmp4";

		const response = await fetch(
			`https://phantom-api.us.ci/api${endpoint}?url=${encodeURIComponent(chosen.url)}&format=${format}`
		);
		const data = await response.json();

		if (!data?.success) {
			return m.reply(data?.message || "Download failed.");
		}

		const { title, download_url, thumbnail } = data.result;

		const buffer = await fetch(download_url).then(r => Buffer.from(await r.arrayBuffer()));
		const mimetype = isVideo ? "video/mp4" : "audio/mpeg";

		if (isVideo) {
			await m.reply({ video: buffer, mimetype, caption: title });
		} else {
			const thumb = await fetch(thumbnail).then(r => Buffer.from(await r.arrayBuffer()));
			await m.reply({ document: buffer, mimetype, fileName: `${title}.mp3`, thumbnail: thumb, caption: title });
		}

		delete sock.youtube[m.sender];
	},
};