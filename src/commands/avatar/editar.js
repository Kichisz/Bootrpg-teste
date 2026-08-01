const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
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

async function deleteOldPhotoMessage(client, msgId) {
    if (!msgId) return;
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (channel) {
            const oldMsg = await channel.messages.fetch(msgId).catch(() => null);
            if (oldMsg) {
                await oldMsg.delete().catch(() => {});
            }
        }
    } catch (e) {
        console.error('Erro ao deletar mensagem antiga:', e);
    }
}

module.exports = async (interaction) => {
    const userId = interaction.user.id;
    let tuppers = [];

    try {
        tuppers = db.prepare('SELECT * FROM tuppers WHERE userId = ?').all(userId);
    } catch (e) {
        tuppers = [];
    }

    const initialEmbed = new EmbedBuilder()
        .setTitle('✏️ Editar Avatar')
        .setDescription('Selecione abaixo qual avatar você deseja editar:')
        .setColor(0x5865F2);

    if (!tuppers || tuppers.length === 0) {
        initialEmbed.setDescription('❌ Você não possui nenhum avatar cadastrado para editar!');
        initialEmbed.setColor(0xED4245);
        return interaction.reply({ embeds: [initialEmbed], flags: [MessageFlags.Ephemeral] });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_tupper_edit')
        .setPlaceholder('Selecione o avatar...')
        .addOptions(
            tuppers.slice(0, 25).map(t => {
                let displayName = safeTruncate(t.nome || 'Avatar sem nome', 100);
                let desc = safeTruncate(`Prefixo: ${t.prefixo || 'Nenhum'}`, 100);

                return new StringSelectMenuOptionBuilder()
                    .setLabel(displayName)
                    .setDescription(desc)
                    .setValue(String(t.id));
            })
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
        embeds: [initialEmbed],
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({ time: 60000, max: 1 });

    collector.on('collect', async i => {
        if (!i.isStringSelectMenu()) return;
        const tupperId = i.values[0];
        const tupper = db.prepare('SELECT * FROM tuppers WHERE id = ? AND userId = ?').get(tupperId, userId);

        if (!tupper) {
            const errEmbed = new EmbedBuilder().setTitle('❌ Erro').setDescription('Avatar não encontrado.').setColor(0xED4245);
            return i.update({ embeds: [errEmbed], components: [] });
        }

        const optionsMenu = new StringSelectMenuBuilder()
            .setCustomId('select_edit_field')
            .setPlaceholder('O que você deseja editar?')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('Nome').setDescription('Alterar o nome do avatar').setValue('edit_name'),
                new StringSelectMenuOptionBuilder().setLabel('Foto').setDescription('Alterar a imagem do avatar').setValue('edit_photo'),
                new StringSelectMenuOptionBuilder().setLabel('Prefixo').setDescription('Alterar o prefixo do avatar').setValue('edit_prefix'),
                new StringSelectMenuOptionBuilder().setLabel('Visibilidade').setDescription('Alternar entre Público 🟢 e Privado 🔒').setValue('edit_visibility'),
                new StringSelectMenuOptionBuilder().setLabel('Escopo').setDescription('Alternar entre Worldwide 🌍 e Local 🏠').setValue('edit_scope')
            ]);

        const optionsRow = new ActionRowBuilder().addComponents(optionsMenu);

        const embed = new EmbedBuilder()
            .setTitle(`✏️ Editando: ${safeTruncate(tupper.nome || 'Sem Nome', 50)}`)
            .setDescription('Escolha no menu abaixo qual propriedade você deseja alterar:')
            .setColor(0x5865F2);
        
        if (tupper.fotoUrl) embed.setThumbnail(tupper.fotoUrl);

        await i.update({ embeds: [embed], components: [optionsRow] });

        const fieldCollector = i.message.createMessageComponentCollector({ time: 60000, max: 1 });
        fieldCollector.on('collect', async i2 => {
            if (!i2.isStringSelectMenu()) return;
            const choice = i2.values[0];

            if (choice === 'edit_name') {
                const promptEmbed = new EmbedBuilder()
                    .setTitle(`✏️ Editando Nome: ${safeTruncate(tupper.nome, 40)}`)
                    .setDescription('Digite o **novo nome** para o avatar no chat:')
                    .setColor(0x5865F2);

                await i2.update({ embeds: [promptEmbed], components: [] });

                const msgCol = interaction.channel.createMessageCollector({
                    filter: m => m?.author && !m.author.bot && m.author.id === userId,
                    time: 60000,
                    max: 1
                });

                msgCol.on('collect', async m => {
                    await m.delete().catch(() => {});
                    const newName = m.content.trim();
                    if (!newName) return;

                    db.prepare('UPDATE tuppers SET nome = ? WHERE id = ?').run(newName, tupper.id);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Nome Atualizado!')
                        .setDescription(`O nome foi atualizado para **${safeTruncate(newName, 100)}** com sucesso!`)
                        .setColor(0x57F287);

                    await interaction.editReply({ embeds: [successEmbed], components: [] });
                });

            } else if (choice === 'edit_prefix') {
                const promptEmbed = new EmbedBuilder()
                    .setTitle(`✏️ Editando Prefixo: ${safeTruncate(tupper.nome, 40)}`)
                    .setDescription('Digite o **novo prefixo** para o avatar no chat (ex: `novo:`):')
                    .setColor(0x5865F2);

                await i2.update({ embeds: [promptEmbed], components: [] });

                const msgCol = interaction.channel.createMessageCollector({
                    filter: m => m?.author && !m.author.bot && m.author.id === userId,
                    time: 60000,
                    max: 1
                });

                msgCol.on('collect', async m => {
                    await m.delete().catch(() => {});
                    const newPrefix = m.content.trim();

                    const existing = db.prepare('SELECT id FROM tuppers WHERE userId = ? AND prefixo = ? AND id != ?').get(userId, newPrefix, tupper.id);
                    if (existing) {
                        const errEmbed = new EmbedBuilder()
                            .setTitle('❌ Erro')
                            .setDescription(`Você já possui outro avatar com o prefixo **${safeTruncate(newPrefix, 50)}**!`)
                            .setColor(0xED4245);
                        return interaction.editReply({ embeds: [errEmbed], components: [] });
                    }

                    db.prepare('UPDATE tuppers SET prefixo = ? WHERE id = ?').run(newPrefix, tupper.id);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Prefixo Atualizado!')
                        .setDescription(`O prefixo foi atualizado para **${safeTruncate(newPrefix, 50)}** com sucesso!`)
                        .setColor(0x57F287);

                    await interaction.editReply({ embeds: [successEmbed], components: [] });
                });

            } else if (choice === 'edit_visibility') {
                const newVis = tupper.isPublic ? 0 : 1;
                db.prepare('UPDATE tuppers SET isPublic = ? WHERE id = ?').run(newVis, tupper.id);

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Visibilidade Atualizada!')
                    .setDescription(`A visibilidade do avatar **${safeTruncate(tupper.nome, 50)}** agora é: **${newVis ? 'Público 🟢' : 'Privado 🔒'}**`)
                    .setColor(0x57F287);

                await i2.update({ embeds: [successEmbed], components: [] });

            } else if (choice === 'edit_scope') {
                const newScope = tupper.isGlobal ? 0 : 1;
                db.prepare('UPDATE tuppers SET isGlobal = ? WHERE id = ?').run(newScope, tupper.id);

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Escopo Atualizado!')
                    .setDescription(`O escopo do avatar **${safeTruncate(tupper.nome, 50)}** agora é: **${newScope ? 'Worldwide 🌍' : 'Apenas este servidor 🏠'}**`)
                    .setColor(0x57F287);

                await i2.update({ embeds: [successEmbed], components: [] });

            } else if (choice === 'edit_photo') {
                const promptEmbed = new EmbedBuilder()
                    .setTitle(`✏️ Editando Foto: ${safeTruncate(tupper.nome, 40)}`)
                    .setDescription('Envie no chat a **nova imagem** (anexada ou link):')
                    .setColor(0x5865F2);

                await i2.update({ embeds: [promptEmbed], components: [] });

                const msgCol = interaction.channel.createMessageCollector({
                    filter: m => m?.author && !m.author.bot && m.author.id === userId,
                    time: 60000,
                    max: 1
                });

                msgCol.on('collect', async m => {
                    let bufferToUpload = null;
                    let filename = 'avatar.png';

                    if (m.attachments && m.attachments.size > 0) {
                        const att = m.attachments.first();
                        filename = att.name || 'avatar.png';
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
                    } else if (m.content) {
                        const trimmed = m.content.trim();
                        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                            try {
                                const res = await fetch(trimmed, {
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
                    }

                    await m.delete().catch(() => {});

                    if (!bufferToUpload) {
                        const errEmbed = new EmbedBuilder()
                            .setTitle('❌ Erro')
                            .setDescription('Nenhuma imagem válida ou link foi encontrado. Operação cancelada.')
                            .setColor(0xED4245);
                        return interaction.editReply({ embeds: [errEmbed], components: [] });
                    }

                    const loadingEmbed = new EmbedBuilder()
                        .setTitle('⏳ Processando...')
                        .setDescription('Salvando a nova foto e removendo a antiga...')
                        .setColor(0x5865F2);
                    await interaction.editReply({ embeds: [loadingEmbed], components: [] });

                    const uploadResult = await uploadToPrivateChannel(interaction.client, bufferToUpload, filename);

                    if (!uploadResult.url) {
                        const errEmbed = new EmbedBuilder()
                            .setTitle('❌ Erro no Upload')
                            .setDescription('Não foi possível enviar a nova foto para o servidor privado.')
                            .setColor(0xED4245);
                        return interaction.editReply({ embeds: [errEmbed], components: [] });
                    }

                    // Apaga a mensagem antiga do canal privado se existir
                    if (tupper.fotoMsgId) {
                        await deleteOldPhotoMessage(interaction.client, tupper.fotoMsgId);
                    }

                    db.prepare('UPDATE tuppers SET fotoUrl = ?, fotoMsgId = ? WHERE id = ?').run(uploadResult.url, uploadResult.msgId, tupper.id);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Foto Atualizada com Sucesso!')
                        .setDescription(`A foto do avatar **${safeTruncate(tupper.nome, 50)}** foi alterada com sucesso!`)
                        .setColor(0x57F287)
                        .setThumbnail(uploadResult.url);

                    await interaction.editReply({ embeds: [successEmbed], components: [] });
                });
            }
        });
    });
};