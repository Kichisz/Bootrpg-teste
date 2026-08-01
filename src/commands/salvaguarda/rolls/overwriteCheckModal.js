const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getSalvaguardaDb } = require('./dbConfig');
const { obterContextoAtivo } = require('./checkActiveContext');
const { iniciarSelecaoComponentes } = require('./componentSelectionMenu');

async function verificarSobrescricao(interaction, subtipoChave) {
    const contexto = obterContextoAtivo(interaction.user.id, interaction.guild.id);
    if (contexto.erro) {
        if (!interaction.deferred && !interaction.replied) {
            return interaction.reply({ content: contexto.erro, ephemeral: true });
        }
        return interaction.editReply({ content: contexto.erro, components: [] });
    }

    // Verifica se já existe configuração salva para este subtipo
    const db = getSalvaguardaDb();
    let configExistente = null;
    try {
        configExistente = db.prepare(`
            SELECT * FROM salvaguarda_configs 
            WHERE userId = ? AND sistemaNome = ? AND avatarNome = ? AND fichaId = ? AND subtipoChave = ?
        `).get(interaction.user.id, contexto.nomeSistema, contexto.avatarNome, contexto.fichaId, subtipoChave);
    } catch (e) {}
    db.close();

    // Se NÃO existir configuração, passa direto para a seleção de componentes
    if (!configExistente) {
        return iniciarSelecaoComponentes(interaction, subtipoChave);
    }

    // Se JÁ existir, exibe o aviso com os botões Sim / Não
    if (!interaction.deferred && !interaction.replied) {
        try { await interaction.deferUpdate(); } catch (e) {}
    }

    const embed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('⚠️ Configuração Existente')
        .setDescription(
            `O subtipo **${subtipoChave}** já possui uma configuração salva para esta ficha.\n\n` +
            'Deseja realmente substituir a configuração atual por uma nova?'
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`salv_overwrite_yes_${subtipoChave}`)
            .setLabel('Sim, substituir')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`salv_overwrite_no_${subtipoChave}`)
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });

    try {
        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && (i.customId === `salv_overwrite_yes_${subtipoChave}` || i.customId === `salv_overwrite_no_${subtipoChave}`),
            time: 300000
        });

        collector.on('collect', async i => {
            if (!i.deferred && !i.replied) {
                try { await i.deferUpdate(); } catch (e) {}
            }

            collector.stop();

            if (i.customId.startsWith('salv_overwrite_yes_')) {
                return iniciarSelecaoComponentes(i, subtipoChave);
            } else {
                const embedCancel = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('❌ Operação Cancelada')
                    .setDescription('A configuração anterior foi mantida intacta.');
                return i.editReply({ embeds: [embedCancel], components: [] });
            }
        });
    } catch (err) {
        console.error("Erro no coletor de sobrescrita:", err);
    }
}

module.exports = { verificarSobrescricao };