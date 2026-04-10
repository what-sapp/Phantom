const axios = require("axios");
const FormData = require("form-data");

async function uploadToTmpFiles(buffer, opts) {
  if (!Buffer.isBuffer(buffer)) throw new Error("buffer must be a Buffer");
  if (!opts?.filename) throw new Error("opts.filename is required (e.g., image.jpg)");

  const form = new FormData();
  form.append("file", buffer, {
    filename: opts.filename,
    contentType: opts.contentType || "application/octet-stream",
    knownLength: buffer.length,
  });

  const res = await axios.post("https://tmpfiles.org/api/v1/upload", form, {
    headers: {
      ...form.getHeaders(),
      Accept: "application/json",
    },
    timeout: opts.timeoutMs ?? 60_000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  })
  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      `Upload failed (HTTP ${res.status}): ${
        typeof res.data === "string" ? res.data : JSON.stringify(res.data)
      }`
    );
  }
  const url = res.data?.data?.url;
  if (!url) throw new Error("Response missing data.url");
  const directUrl = url.replace("http://tmpfiles.org/", "https://tmpfiles.org/dl/");
  return { url, directUrl };
}

module.exports = { uploadToTmpFiles };