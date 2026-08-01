const { EmbedBuilder, MessageFlags } = require('discord.js');
const { itensDb, gerarIdUnico } = require('../database/dbManager');
const { validateWeight } = require('../utils/weightValidation');

module.exports = async function(interaction, activeSystem) {
    const promptEmbed = new EmbedBuilder()
        .setTitle('📦 Criar Item Comum')
        .setDescription('Sistema ativo: **' + activeSystem + '**\n\nEscreva o nome do item e o peso usando **ponto (.)** para decimais, separados por `:`, exemplo: `Corda: 0.1`.\nVocê pode cadastrar vários itens separando por vírgula `,` (ex: `corda:0.1, couro:0.5`).\n*O peso mínimo é 0 ou 0.1kg.*')
        .setColor(0x5865F2);

    await interaction.update({ embeds: [promptEmbed], components: [] });

    const msgCol = interaction.channel.createMessageCollector({
        filter: m => m.author.id === interaction.user.id,
        time: 60000,
        max: 1
    });

    msgCol.on('collect', async m => {
        await m.delete().catch(() => {});
        const content = m.content.trim();
        const parts = content.split(',');
        let savedItems = [];

        for (let part of parts) {
            if (!part.includes(':')) continue;
            let [name, weightStr] = part.split(':');
            name = name.trim();
            const validation = validateWeight(weightStr);

            if (!validation.valid) {
                const errEmbed = new EmbedBuilder().setTitle('❌ Erro de Validação').setDescription(validation.message).setColor(0xED4245);
                return interaction.editReply({ embeds: [errEmbed] });
            }

            const uniqueId = gerarIdUnico();

            itensDb.prepare('INSERT INTO itens (id, userId, guildId, systemName, nome, peso) VALUES (?, ?, ?, ?, ?, ?)').run(
                uniqueId, interaction.user.id, interaction.guild.id, activeSystem, name, validation.value
            );
            savedItems.push(`• **${name}** (${validation.value}kg) - ID: \`${uniqueId}\``);
        }

        if (savedItems.length === 0) {
            const errEmbed = new EmbedBuilder().setTitle('❌ Erro').setDescription('Formato inválido utilizado. Operação cancelada.').setColor(0xED4245);
            return interaction.editReply({ embeds: [errEmbed] });
        }

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Itens Criados com Sucesso!')
            .setDescription(`Sistema: **${activeSystem}**\n\nItens salvos:\n${savedItems.join('\n')}`)
            .setColor(0x57F287);

        await interaction.editReply({ embeds: [successEmbed] });
    });
};