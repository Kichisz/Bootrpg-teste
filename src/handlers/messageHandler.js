const db = require('../database');

module.exports = async (message) => {
    if (!message || !message.author || message.author.bot || !message.guild) return;

    let tupperToUse = null;
    let cleanContent = message.content || '';

    let userTuppers = [];
    try {
        userTuppers = db.prepare('SELECT * FROM tuppers WHERE userId = ? AND (isGlobal = 1 OR guildId = ?)').all(message.author.id, message.guild.id);
    } catch (e) {
        return;
    }

    // 1. Verifica prefixo estritamente utilizando a coluna "prefixo"
    for (const t of userTuppers) {
        if (t.prefixo && message.content && message.content.startsWith(t.prefixo)) {
            tupperToUse = t;
            cleanContent = message.content.slice(t.prefixo.length).trim();
            break;
        }
    }

    // Se usou prefixo mas não há conteúdo nem anexos, apenas ignora sem mexer na mensagem
    if (tupperToUse && cleanContent === '' && message.attachments.size === 0) {
        return;
    }

    // 2. Verifica canal ativo se não usou prefixo
    let channelActive = null;
    try {
        channelActive = db.prepare('SELECT * FROM active_channels WHERE guildId = ? AND channelId = ?').get(message.guild.id, message.channel.id);
    } catch (e) {}

    if (!tupperToUse) {
        if (!channelActive) return;
        try {
            const activeRecord = db.prepare('SELECT tupperId FROM active_tuppers WHERE userId = ? AND guildId = ?').get(message.author.id, message.guild.id);
            if (activeRecord) {
                tupperToUse = db.prepare('SELECT * FROM tuppers WHERE id = ?').get(activeRecord.tupperId);
            }
        } catch (e) {}
    }

    if (!tupperToUse) {
        if (!channelActive) return;
        try {
            await message.delete().catch(() => {});
            const warning = await message.channel.send({
                content: `<@${message.author.id}>, você não pode falar aqui! Ative um avatar com \`/avatar ativar\` ou use o prefixo.`
            });
            setTimeout(() => warning.delete().catch(() => {}), 5000);
        } catch (e) {}
        return;
    }

    try {
        await message.delete().catch(() => {});
        const webhooks = await message.channel.fetchWebhooks().catch(() => new Map());
        let webhook = webhooks.find(w => w.owner && w.owner.id === message.client.user.id);

        if (!webhook) {
            webhook = await message.channel.createWebhook({ 
                name: 'TupperSystem',
                avatar: message.client.user.displayAvatarURL(),
                reason: 'Sistema de avatares automáticos'
            }).catch(() => null);
        }

        if (!webhook) return;

        // Dispara o webhook usando rigorosamente "nome" e "fotoUrl"
        await webhook.send({
            content: cleanContent || '*(Mídia ou mensagem vazia)*',
            username: tupperToUse.nome,
            avatarURL: tupperToUse.fotoUrl || message.author.displayAvatarURL(),
            files: message.attachments.map(att => att.url)
        });

    } catch (error) {
        console.error('❌ Erro ao enviar mensagem por Webhook:', error);
    }
};