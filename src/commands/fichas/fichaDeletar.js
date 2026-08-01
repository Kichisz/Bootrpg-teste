const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const fichaManager = require('./fichaManager');

const sessoesDeletar = new Map();

async function iniciarDelecao(interaction) {
    const userId = interaction.user.id;
    let fichas = [];

    try {
        fichas = fichaManager.db.prepare('SELECT id, nomePersonagem, sistemaNome, avatarNome, dadosJson FROM fichas WHERE userId = ?').all(userId);
    } catch (e) {
        fichas = [];
    }

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Deletar Ficha de Personagem')
        .setDescription('Selecione abaixo qual(is) ficha(s) você deseja excluir de forma privada:')
        .setColor(0xED4245);

    if (!fichas || fichas.length === 0) {
        embed.setDescription('❌ Você não possui nenhuma ficha cadastrada para deletar.');
        return await interaction.reply({ embeds: [embed], components: [], flags: MessageFlags.Ephemeral });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ficha_deletar_selecionar')
        .setPlaceholder('Selecione as fichas para deletar...')
        .setMinValues(1)
        .setMaxValues(Math.min(fichas.length, 25))
        .addOptions(
            fichas.slice(0, 25).map(f => {
                let dados = {};
                try { dados = JSON.parse(f.dadosJson || '{}'); } catch(e){}
                const nome = dados.informacoesGerais?.nome || f.nomePersonagem || 'Personagem';
                const label = `${nome} (${f.sistemaNome})`;
                const desc = `Avatar: ${f.avatarNome}`;
                return {
                    label: label.length > 100 ? label.substring(0, 97) + '...' : label,
                    description: desc.length > 100 ? desc.substring(0, 97) + '...' : desc,
                    value: String(f.id)
                };
            })
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    sessoesDeletar.set(userId, { fichas });

    return await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
}

async function tratarInteracao(interaction) {
    const customId = interaction.customId;
    const userId = interaction.user.id;

    if (customId === 'ficha_deletar_selecionar') {
        if (!interaction.isStringSelectMenu()) return false;
        await interaction.deferUpdate().catch(() => {});

        const idsSelecionados = interaction.values;
        const session = sessoesDeletar.get(userId) || {};
        session.idsSelecionados = idsSelecionados;
        sessoesDeletar.set(userId, session);

        const confirmButton = new ButtonBuilder()
            .setCustomId('ficha_deletar_confirmar')
            .setLabel('Confirmar Exclusão')
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId('ficha_deletar_cancelar')
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary);

        const buttonRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        const embed = new EmbedBuilder()
            .setTitle('⚠️ Confirmação de Exclusão')
            .setDescription(`Você selecionou **${idsSelecionados.length}** ficha(s) para exclusão. Tem certeza? Esta ação não pode ser desfeita.`)
            .setColor(0xED4245);

        await interaction.editReply({ embeds: [embed], components: [buttonRow] });
        return true;
    }

    if (customId === 'ficha_deletar_confirmar') {
        if (!interaction.isButton()) return false;
        await interaction.deferUpdate().catch(() => {});

        const session = sessoesDeletar.get(userId);
        if (!session || !session.idsSelecionados) {
            const errEmbed = new EmbedBuilder().setTitle('❌ Erro').setDescription('Sessão expirada ou inválida.').setColor(0xED4245);
            await interaction.editReply({ embeds: [errEmbed], components: [] });
            return true;
        }

        try {
            const placeholders = session.idsSelecionados.map(() => '?').join(',');
            fichaManager.db.prepare(`DELETE FROM fichas WHERE id IN (${placeholders}) AND userId = ?`).run(...session.idsSelecionados, userId);

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Ficha(s) Deletada(s)')
                .setDescription('A(s) ficha(s) selecionada(s) foi(ram) excluída(s) com sucesso!')
                .setColor(0x57F287);

            await interaction.editReply({ embeds: [successEmbed], components: [] });
        } catch (e) {
            const errEmbed = new EmbedBuilder().setTitle('❌ Erro').setDescription('Ocorreu um erro ao excluir as fichas no banco de dados.').setColor(0xED4245);
            await interaction.editReply({ embeds: [errEmbed], components: [] });
        }

        sessoesDeletar.delete(userId);
        return true;
    }

    if (customId === 'ficha_deletar_cancelar') {
        if (!interaction.isButton()) return false;
        await interaction.deferUpdate().catch(() => {});
        sessoesDeletar.delete(userId);

        const cancelEmbed = new EmbedBuilder()
            .setTitle('❌ Operação Cancelada')
            .setDescription('Nenhuma ficha foi excluída.')
            .setColor(0xED4245);

        await interaction.editReply({ embeds: [cancelEmbed], components: [] });
        return true;
    }

    return false;
}

module.exports = {
    iniciarDelecao,
    tratarInteracao,
    sessoesDeletar
};