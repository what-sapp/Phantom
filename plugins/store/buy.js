const { getDatabase } = require('../../src/lib/database')
const orderPoller = require('../../src/lib/orderPoller')
const path = require('path')
const fs = require('fs')

const pluginConfig = {
    name: 'beliproduk',
    alias: ['buyproduk', 'belisaldo', 'buywithkoin', 'ordersaldo'],
    category: 'store',
    description: 'Beli produk dengan saldo/koin',
    usage: '.beliproduk [nomor_produk] [jumlah]',
    example: '.beliproduk 1',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const groupData = db.getGroup(m.chat) || {}
    
    if (groupData.botMode !== 'store') {
        return m.reply(`❌ Fitur ini hanya tersedia di mode *STORE*!`)
    }
    
    const products = groupData.storeConfig?.products || []
    
    if (products.length === 0) {
        return m.reply(`❌ Belum ada produk!\n\n> Hubungi admin grup.`)
    }
    
    const cleanJid = m.sender.split('@')[0]
    if (!db.db.data.users[cleanJid]) {
        db.setUser(m.sender)
    }
    const userKoin = db.db.data.users[cleanJid].koin || 0
    
    const args = m.text?.trim().split(/\s+/) || []
    const productIdx = parseInt(args[0]) - 1
    const qty = parseInt(args[1]) || 1
    
    if (isNaN(productIdx) || productIdx < 0 || productIdx >= products.length) {
        const storeImage = path.join(process.cwd(), 'assets', 'images', 'ourin-store.jpg')
        
        let txt = `💳 *ʙᴇʟɪ ᴅᴇɴɢᴀɴ sᴀʟᴅᴏ*\n\n`
        txt += `> Bayar produk menggunakan *Koin* in-game!\n`
        txt += `> Saldo kamu: *Rp ${userKoin.toLocaleString('id-ID')}*\n`
        txt += `━━━━━━━━━━━━━━━\n\n`
        
        products.forEach((p, i) => {
            const stock = p.stock === -1 ? '∞' : (p.stockItems?.length || p.stock || 0)
            const hasMedia = p.image || p.video ? '📷' : ''
            const affordable = userKoin >= p.price ? '✅' : '❌'
            txt += `*${i + 1}.* ${hasMedia} ${p.name}\n`
            txt += `   💰 Rp ${p.price.toLocaleString('id-ID')} ${affordable}\n`
            txt += `   📦 Stok: ${stock}\n`
            if (p.description) txt += `   📝 ${p.description.substring(0, 30)}${p.description.length > 30 ? '...' : ''}\n`
            txt += `\n`
        })
        
        txt += `━━━━━━━━━━━━━━━\n`
        txt += `> ✅ = Saldo cukup | ❌ = Saldo kurang\n`
        txt += `> Pilih produk di bawah untuk beli`
        
        const productRows = products.map((p, i) => ({
            title: `${i + 1}. ${p.name}`,
            description: `Rp ${p.price.toLocaleString('id-ID')} | Stok: ${p.stockItems?.length || p.stock || 0}`,
            id: `${m.prefix}beliproduk ${i + 1}`
        }))
        
        const interactiveButtons = [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '💳 ᴘɪʟɪʜ ᴘʀᴏᴅᴜᴋ',
                    sections: [{
                        title: 'ʙᴇʟɪ ᴅᴇɴɢᴀɴ sᴀʟᴅᴏ',
                        rows: productRows
                    }]
                })
            },
            {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '💰 ᴄᴇᴋ sᴀʟᴅᴏ',
                    id: `${m.prefix}me`
                })
            }
        ]
        
        let thumbnail = null
        if (fs.existsSync(storeImage)) {
            thumbnail = fs.readFileSync(storeImage)
        }
        
        return sock.sendMessage(m.chat, {
            text: txt,
            contextInfo: thumbnail ? {
                externalAdReply: {
                    title: '💳 Beli dengan Saldo',
                    body: `Saldo: Rp ${userKoin.toLocaleString('id-ID')}`,
                    thumbnail,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            } : undefined,
            interactiveButtons
        }, { quoted: m })
    }
    
    const product = products[productIdx]
    const actualStock = product.stockItems?.length || product.stock || 0
    
    if (product.stock !== -1 && actualStock < qty) {
        return m.reply(`❌ Stok tidak cukup!\n\n> Tersedia: ${actualStock}`)
    }
    
    const total = product.price * qty
    
    if (userKoin < total) {
        return m.reply(
            `❌ *sᴀʟᴅᴏ ᴛɪᴅᴀᴋ ᴄᴜᴋᴜᴘ*\n\n` +
            `> Koin kamu: Rp ${userKoin.toLocaleString('id-ID')}\n` +
            `> Harga: Rp ${total.toLocaleString('id-ID')}\n` +
            `> Kurang: Rp ${(total - userKoin).toLocaleString('id-ID')}\n\n` +
            `> Kumpulkan Koin dari game RPG!`
        )
    }
    
    const orderId = `BAL${Date.now().toString(36).toUpperCase()}`
    
    db.db.data.users[cleanJid].koin = userKoin - total
    
    if (product.stock !== -1) {
        products[productIdx].stock = (products[productIdx].stock || 0) - qty
    }
    
    let stockItemsToSend = []
    if (product.stockItems?.length > 0 && qty <= product.stockItems.length) {
        stockItemsToSend = product.stockItems.splice(0, qty)
        products[productIdx].stockItems = product.stockItems
    }
    
    groupData.storeConfig.products = products
    db.setGroup(m.chat, groupData)
    await db.save()
    
    const orderData = {
        orderId,
        groupId: m.chat,
        buyerJid: m.sender,
        buyerName: m.pushName || m.sender.split('@')[0],
        items: [{ 
            id: product.id,
            name: product.name, 
            qty, 
            price: product.price 
        }],
        total,
        status: 'completed',
        paymentMethod: 'balance',
        productDetail: product.detail || null,
        productImage: product.image || null,
        productDescription: product.description || null,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
    }
    
    orderPoller.createOrder(orderId, orderData)
    
    let successTxt = `✅ *ᴘᴇᴍʙᴇʟɪᴀɴ ʙᴇʀʜᴀsɪʟ!*\n\n`
    successTxt += `> Order ID: \`${orderId}\`\n`
    successTxt += `> Pembeli: @${m.sender.split('@')[0]}\n`
    successTxt += `━━━━━━━━━━━━━━━\n\n`
    successTxt += `📦 *ɪᴛᴇᴍ:*\n`
    successTxt += `> ${product.name} x${qty}\n\n`
    successTxt += `💰 *ᴛᴏᴛᴀʟ:* Rp ${total.toLocaleString('id-ID')}\n`
    successTxt += `💳 *ᴍᴇᴛᴏᴅᴇ:* Saldo Koin\n`
    successTxt += `💵 *sɪsᴀ sᴀʟᴅᴏ:* Rp ${(userKoin - total).toLocaleString('id-ID')}\n\n`
    successTxt += `━━━━━━━━━━━━━━━`
    
    await m.reply(successTxt, { mentions: [m.sender] })
    m.react('✅')
    
    if (product.detail || stockItemsToSend.length > 0) {
        let detailTxt = `📦 *ᴅᴇᴛᴀɪʟ ᴘʀᴏᴅᴜᴋ*\n\n`
        detailTxt += `> Order ID: \`${orderId}\`\n`
        detailTxt += `> Produk: *${product.name}*\n\n`
        
        if (stockItemsToSend.length > 0) {
            detailTxt += `📋 *ᴅᴀᴛᴀ ᴀᴋᴜɴ:*\n`
            stockItemsToSend.forEach((item, idx) => {
                detailTxt += `\n*[${idx + 1}]*\n${item}\n`
            })
        } else if (product.detail) {
            detailTxt += `📋 *ɪɴꜰᴏ:*\n${product.detail}\n`
        }
        
        detailTxt += `\n━━━━━━━━━━━━━━━\n`
        detailTxt += `> Terima kasih telah berbelanja! ❤️`
        
        try {
            await sock.sendMessage(m.sender, { text: detailTxt })
        } catch (e) {
            await m.reply(detailTxt)
        }
    }
}

module.exports = {
    config: pluginConfig,
    handler
}
