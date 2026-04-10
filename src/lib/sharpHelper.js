/**
 * sharpHelper.js
 * Pengganti sharp untuk Termux
 * Pakai @napi-rs/canvas untuk resize/thumbnail
 * Pakai ffmpeg untuk convert ke WebP
 */

const fs = require('fs')
const path = require('path')
const { createCanvas, loadImage } = require('@napi-rs/canvas')

const ffmpeg = require('fluent-ffmpeg')
ffmpeg.setFfmpegPath('/data/data/com.termux/files/usr/bin/ffmpeg')

function getTempDir() {
    const tmpDir = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    return tmpDir
}

/**
 * Resize gambar ke ukuran tertentu, return Buffer PNG
 * Pengganti: sharp(buf).resize(w, h).toBuffer()
 */
async function resizeImage(buffer, width, height) {
    const img = await loadImage(buffer)
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    // contain: jaga aspect ratio, background transparan
    const scale = Math.min(width / img.width, height / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    const dx = (width - dw) / 2
    const dy = (height - dh) / 2
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(img, dx, dy, dw, dh)
    return await canvas.encode('png')
}

/**
 * Resize gambar ke ukuran tertentu, return Buffer JPEG
 * Pengganti: sharp(buf).resize(w, h).jpeg({ quality }).toBuffer()
 */
async function resizeImageJpeg(buffer, width, height, quality = 80) {
    const img = await loadImage(buffer)
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    const scale = Math.min(width / img.width, height / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    const dx = (width - dw) / 2
    const dy = (height - dh) / 2
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, dx, dy, dw, dh)
    return await canvas.encode('jpeg', quality)
}

/**
 * Convert image buffer ke WebP 512x512 (untuk sticker)
 * Pengganti: sharp(buf).resize(512,512,{fit:'contain'}).webp({quality:80}).toBuffer()
 */
async function imageToWebp(buffer) {
    const tmpDir = getTempDir()
    const inputPath = path.join(tmpDir, `img_${Date.now()}.png`)
    const outputPath = path.join(tmpDir, `sticker_${Date.now()}.webp`)

    // Resize dulu ke 512x512 pakai canvas
    const resized = await resizeImage(buffer, 512, 512)
    fs.writeFileSync(inputPath, resized)

    return new Promise((resolve, reject) => {
        const cleanup = () => {
            try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath) } catch {}
            try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath) } catch {}
        }

        ffmpeg(inputPath)
            .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
                '-loop', '0',
                '-preset', 'default',
                '-an',
                '-vsync', '0',
                '-q:v', '80'
            ])
            .toFormat('webp')
            .on('end', () => {
                try {
                    const result = fs.readFileSync(outputPath)
                    cleanup()
                    resolve(result)
                } catch (err) {
                    cleanup()
                    reject(err)
                }
            })
            .on('error', (err) => {
                cleanup()
                reject(new Error('FFmpeg error: ' + err.message))
            })
            .save(outputPath)
    })
}

/**
 * Convert image buffer ke PNG buffer
 * Pengganti: sharp(buf).png().toBuffer()
 */
async function toPng(buffer) {
    const img = await loadImage(buffer)
    const canvas = createCanvas(img.width, img.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    return await canvas.encode('png')
}

/**
 * Ambil metadata gambar (width, height)
 * Pengganti: sharp(buf).metadata()
 */
async function getMetadata(buffer) {
    const img = await loadImage(buffer)
    return { width: img.width, height: img.height }
}

module.exports = {
    resizeImage,
    resizeImageJpeg,
    imageToWebp,
    toPng,
    getMetadata
}
