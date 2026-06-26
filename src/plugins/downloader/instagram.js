import { fileTypeFromBuffer } from "file-type";

export default {
	name: "instagram",
	description: "Instagram downloader.",
	command: ["ig", "instagram"],
	usage: "$prefix$command https://www.instagram.com/reel/C_Fyz3bJ2PF/",
	permissions: "all",
	hidden: false,
	failed: "Failed to execute %command: %error",
	wait: null,
	category: "downloader",
	cooldown: 5,
	limit: false,
	react: true,

	execute: async (m) => {
		const input =
			m.text && m.text.trim() !== ""
				? m.text
				: m.quoted && m.quoted.url
					? m.quoted.url
					: null;

		if (!input) {
			return m.reply("❌ Instagram URL not found.");
		}

		try {
			const response = await fetch(
				`https://phantom-api.us.ci/api/download/ig?url=${encodeURIComponent(input)}`
			);

			const data = await response.json();

			if (!data?.success) {
				return m.reply(`❌ Download failed: ${data?.message || "Unknown error"}`);
			}

			const { results, total } = data.result;

			if (!results || results.length === 0) {
				return m.reply("❌ No content found.");
			}

			const fetchMedia = async (url) => {
				const response = await fetch(url);
				const buffer = Buffer.from(await response.arrayBuffer());
				const type = await fileTypeFromBuffer(buffer);
				return { buffer, type };
			};

			const firstUrl = results[0];
			const { buffer, type } = await fetchMedia(firstUrl);
			const isVideo = type?.mime?.startsWith("video");
			const isImage = type?.mime?.startsWith("image");

			const caption = `📥 *Instagram Downloader*\n\n📦 Total: ${total} media\n🔗 Source: ${input}`;

			if (isVideo) {
				await m.reply({
					video: buffer,
					caption: caption,
				});
			} else if (isImage) {
				await m.reply({
					image: buffer,
					caption: caption,
				});
			} else {
				return m.reply("❌ Unsupported media format.");
			}

			if (results.length > 1) {
				const remaining = results.slice(1);
				
				for (const url of remaining) {
					try {
						const { buffer: buf, type: fileType } = await fetchMedia(url);
						const isRemainingVideo = fileType?.mime?.startsWith("video");
						const isRemainingImage = fileType?.mime?.startsWith("image");

						if (isRemainingVideo) {
							await m.reply({ video: buf });
						} else if (isRemainingImage) {
							await m.reply({ image: buf });
						}
					} catch (error) {
						console.error("Failed to send remaining media:", error);
					}
				}
			}

		} catch (error) {
			console.error("Instagram download error:", error);
			return m.reply(`❌ Download error:\n${error.message || "Unknown error"}`);
		}
	},
};