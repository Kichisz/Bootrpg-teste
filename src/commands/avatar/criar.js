const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../../database');

// Insira aqui o ID do canal do seu servidor privado onde as fotos serão salvas
const LOG_CHANNEL_ID = '1531818397464137788';

// Garante que a coluna fotoMsgId exista na tabela sem quebrar nada
try {
    db.prepare('ALTER TABLE tuppers ADD COLUMN fotoMsgId TEXT').run();
} catch (e) {}

function safeTruncate(str, maxLength = 100) {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
}

async function uploadToPrivateChannel(client, bufferOrUrl, filename = 'avatar.png') {
    try {
        let buffer;
        if (Buffer.isBuffer(bufferOrUrl)) {
            buffer = bufferOrUrl;
        } else {
            const res = await fetch(bufferOrUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            if (!res.ok) throw new Error(`Falha ao baixar imagem: ${res.statusText}`);
            const ab = await res.arrayBuffer();
            buffer = Buffer.from(ab);
        }

        const channel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (!channel) throw new Error('Canal de log privado não encontrado.');

        const msg = await channel.send({
            files: [{ attachment: buffer, name: filename }]
        });

        const url = msg.attachments.first()?.url;
        return { url: url || null, msgId: msg.id };
    } catch (e) {
        console.error('Erro no upload via canal privado:', e);
    }
    return { url: null, msgId: null };
}

module.exports = async (interaction) => {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const embed = new EmbedBuilder()
        .setTitle('🛠️ Criar Avatar (Passo 1/3)')
        .setDescription('Qual o **nome** do avatar?\n*(Opcional: envie com uma foto anexada ou link de uma foto para vincular diretamente)*')
        .setColor(0x5865F2);

    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });

    const filter = m => m.author.id === userId;
    const collector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async m1 => {
        let bufferToUpload = null;
        let photoUrl = null;
        let filename = 'avatar.png';
        let nome = '';

        if (m1.attachments && m1.attachments.size > 0) {
            const att = m1.attachments.first();
            filename = att.name || 'avatar.png';
            nome = m1.content ? m1.content.trim() : '';
            try {
                const res = await fetch(att.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                if (res.ok) {
                    const ab = await res.arrayBuffer();
                    bufferToUpload = Buffer.from(ab);
                }
            } catch (e) {}
        } else if (m1.content) {
            const content = m1.content.trim();
            const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                photoUrl = urlMatch[0];
                nome = content.replace(urlMatch[0], '').trim();
            } else {
                nome = content;
            }
        }

        await m1.delete().catch(() => {});

        if (!nome) {
            nome = 'Avatar sem nome';
        }

        if (photoUrl && !bufferToUpload) {
            try {
                const res = await fetch(photoUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                if (res.ok) {
                    const ab = await res.arrayBuffer();
                    bufferToUpload = Buffer.from(ab);
                }
            } catch (e) {}
        }

        let finalFotoUrl = 'https://imgur.com/h4ZFPfy.png';
        let finalMsgId = null;

        if (bufferToUpload) {
            const loadingEmbed = new EmbedBuilder()
                .setTitle('⏳ Processando...')
                .setDescription('Salvando a foto no servidor privado...')
                .setColor(0x5865F2);
            await interaction.editReply({ embeds: [loadingEmbed] });

            const uploadResult = await uploadToPrivateChannel(interaction.client, bufferToUpload, filename);
            if (uploadResult.url) {
                finalFotoUrl = uploadResult.url;
                finalMsgId = uploadResult.msgId;
            }
        } else if (photoUrl) {
            finalFotoUrl = photoUrl;
        }

        const embed2 = new EmbedBuilder()
            .setTitle('🛠️ Criar Avatar (Passo 2/3)')
            .setDescription(`Nome definido: **${safeTruncate(nome, 50)}**\n\nAgora digite o **prefixo / sintaxe** (ex: \`kichi:\`):`)
            .setColor(0x5865F2);

        await interaction.editReply({ embeds: [embed2] });

        const col2 = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
        col2.on('collect', async m2 => {
            await m2.delete().catch(() => {});
            const prefixo = m2.content.trim();

            const existing = db.prepare('SELECT id FROM tuppers WHERE userId = ? AND prefixo = ?').get(userId, prefixo);
            if (existing) {
                const errEmbed = new EmbedBuilder().setTitle('❌ Erro').setDescription(`Você já possui um avatar com o prefixo **${prefixo}**!`).setColor(0xED4245);
                return interaction.editReply({ embeds: [errEmbed] });
            }

            const embed3 = new EmbedBuilder()
                .setTitle('🛠️ Criar Avatar (Passo 3/3)')
                .setDescription('⚙️ **Configurações Finais:** Escolha o escopo e a visibilidade do seu avatar:')
                .setColor(0x5865F2);

            const rowScope = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('scope_global').setLabel('🌍 Worldwide').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('scope_server').setLabel('🏠 Apenas este Server').setStyle(ButtonStyle.Secondary)
            );

            const rowPublic = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('pub_yes').setLabel('🟢 Público').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('pub_no').setLabel('🔒 Privado (Oculto)').setStyle(ButtonStyle.Danger)
            );

            await interaction.editReply({ embeds: [embed3], components: [rowScope, rowPublic] });

            const replyMsg = await interaction.fetchReply();
            const col3 = replyMsg.createMessageComponentCollector({ time: 60000 });

            let isGlobal = 1;
            let isPublic = 1;
            let scopeChosen = false;
            let publicChosen = false;

            col3.on('collect', async i3 => {
                if (i3.user.id !== userId) return i3.reply({ content: '❌ Apenas quem iniciou pode escolher.', flags: [MessageFlags.Ephemeral] });

                if (i3.customId.startsWith('scope_')) {
                    isGlobal = i3.customId === 'scope_global' ? 1 : 0;
                    scopeChosen = true;
                } else if (i3.customId.startsWith('pub_')) {
                    isPublic = i3.customId === 'pub_yes' ? 1 : 0;
                    publicChosen = true;
                }

                await i3.deferUpdate().catch(() => {});

                if (scopeChosen && publicChosen) {
                    col3.stop();
                    const createdAt = new Date().toLocaleString('pt-BR');

                    db.prepare(`
                        INSERT INTO tuppers (userId, guildId, nome, prefixo, fotoUrl, fotoMsgId, isGlobal, isPublic, createdAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(userId, guildId, nome, prefixo, finalFotoUrl, finalMsgId, isGlobal, isPublic, createdAt);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Avatar Criado com Sucesso!')
                        .setDescription(`O avatar **${safeTruncate(nome, 50)}** foi cadastrado!\n\n• **Prefixo:** \`${prefixo}\`\n• **Escopo:** ${isGlobal ? 'Worldwide 🌍' : 'Apenas este servidor 🏠'}\n• **Visibilidade:** ${isPublic ? 'Público 🟢' : 'Privado 🔒'}`)
                        .setColor(0x57F287)
                        .setThumbnail(finalFotoUrl);

                    await interaction.editReply({ embeds: [successEmbed], components: [] });
                }
            });
        });
    });
};