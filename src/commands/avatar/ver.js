const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');

function safeTruncate(str, maxLength = 100) {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
}

module.exports = async (interaction) => {
    // Pega o usuário mencionado ou o próprio autor se não mencionar ninguém
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const isSelf = targetUser.id === interaction.user.id;

    let tuppers = [];
    try {
        if (isSelf) {
            // Dono vê tudo (públicos e privados)
            tuppers = db.prepare('SELECT * FROM tuppers WHERE userId = ?').all(targetUser.id);
        } else {
            // Outros usuários só veem os avatares públicos daquela pessoa
            tuppers = db.prepare('SELECT * FROM tuppers WHERE userId = ? AND isPublic = 1').all(targetUser.id);
        }
    } catch (e) {
        tuppers = [];
    }

    const initialEmbed = new EmbedBuilder()
        .setTitle(`📋 Lista de Avatares de ${targetUser.username}`)
        .setColor(0x5865F2)
        .setThumbnail(targetUser.displayAvatarURL());

    if (!tuppers || tuppers.length === 0) {
        initialEmbed.setDescription(isSelf 
            ? '❌ Você não possui nenhum avatar cadastrado!' 
            : `❌ O usuário **${targetUser.username}** não possui nenhum avatar público cadastrado.`);
        initialEmbed.setColor(0xED4245);
        return interaction.reply({ 
            embeds: [initialEmbed], 
            flags: isSelf ? [MessageFlags.Ephemeral] : [] 
        });
    }

    // Criação de uma lista rica, bonita e detalhada (sem prefixos na listagem principal)
    let listText = tuppers.map((t, index) => {
        const name = safeTruncate(t.nome || 'Sem Nome', 50);
        const visibility = t.isPublic ? '🟢 Público' : '🔒 Privado';
        const scope = t.isGlobal ? '🌍 Worldwide' : '🏠 Local';
        return `> **#${index + 1}** • **${name}**\n> └ *Configuração:* ${visibility} | ${scope}\n`;
    }).join('\n');

    if (listText.length > 3900) {
        listText = listText.substring(0, 3890) + '\n... (lista muito longa)';
    }

    initialEmbed.setDescription(`Aqui está a listagem detalhada dos avatares de **${targetUser.username}**.\nSelecione um avatar no menu abaixo para inspecionar todas as informações:\n\n${listText}`);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_tupper_ver')
        .setPlaceholder('🔍 Selecione um avatar para ver os detalhes...')
        .addOptions(
            tuppers.slice(0, 25).map(t => {
                let displayName = safeTruncate(t.nome || 'Avatar sem nome', 100);
                let desc = safeTruncate(`Criado em: ${t.createdAt || 'Data desconhecida'}`, 100);

                return new StringSelectMenuOptionBuilder()
                    .setLabel(displayName)
                    .setDescription(desc)
                    .setValue(String(t.id));
            })
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // Se for a própria lista, envia como efêmera (só você vê). Se for de outro, envia público para todos verem.
    await interaction.reply({
        embeds: [initialEmbed],
        components: [row],
        flags: isSelf ? [MessageFlags.Ephemeral] : []
    });

    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
        if (!i.isStringSelectMenu()) return;
        
        // Apenas quem executou o comando ou o próprio dono pode ver os detalhes pelo menu
        if (!isSelf && i.user.id !== interaction.user.id && i.user.id !== targetUser.id) {
            return i.reply({ content: '❌ Você não pode interagir com este menu.', flags: [MessageFlags.Ephemeral] });
        }

        const tupperId = i.values[0];
        const tupper = db.prepare('SELECT * FROM tuppers WHERE id = ?').get(tupperId);

        if (!tupper) {
            const errEmbed = new EmbedBuilder().setTitle('❌ Erro').setDescription('Avatar não encontrado.').setColor(0xED4245);
            return i.update({ embeds: [errEmbed], components: [] });
        }

        const visibilityText = tupper.isPublic ? '🟢 Público (Visível para todos)' : '🔒 Privado (Oculto em listas públicas)';
        const scopeText = tupper.isGlobal ? '🌍 Worldwide (Disponível em todos os servidores)' : '🏠 Server-sided (Apenas neste servidor)';
        const dateText = tupper.createdAt || 'Data não registrada';

        const embed = new EmbedBuilder()
            .setTitle(`👤 Detalhes do Avatar: ${safeTruncate(tupper.nome || 'Sem Nome', 50)}`)
            .addFields(
                { name: '📝 Nome do Avatar', value: safeTruncate(tupper.nome || 'Não definido', 1024), inline: false },
                { name: '⌨️ Sintaxe (Prefixo)', value: `\`${safeTruncate(tupper.prefixo || 'Nenhum', 1024)}\``, inline: false },
                { name: '📅 Data de Criação', value: dateText, inline: true },
                { name: '👁️ Visibilidade', value: visibilityText, inline: true },
                { name: '🌐 Escopo', value: scopeText, inline: false }
            )
            .setColor(0x5865F2);

        if (tupper.fotoUrl && (tupper.fotoUrl.startsWith('http://') || tupper.fotoUrl.startsWith('https://'))) {
            embed.setThumbnail(tupper.fotoUrl);
            embed.addFields({ name: '🖼️ Link da Foto', value: safeTruncate(tupper.fotoUrl, 1024), inline: false });
        } else {
            embed.addFields({ name: '🖼️ Link da Foto', value: 'Nenhuma foto válida cadastrada', inline: false });
        }

        await i.update({ embeds: [embed], components: [] });
    });
};