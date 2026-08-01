const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { obterContextoAtivo, obterSistemaAtivo } = require('./checkActiveContext');
const { exibirMenuSubtiposConfig } = require('./subtypesListMenu');

async function iniciarConfiguracaoSalvaguarda(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛡️ Configuração de Salvaguarda')
        .setDescription('Você quer configurar os subtipos pra sua **ficha de personagem ativo** ou o **sistema genérico para NPCs/inimigos** criados por você?');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('salv_config_tipo_ficha')
            .setLabel('Ficha de Personagem Ativo')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('salv_config_tipo_npc')
            .setLabel('NPCs / Inimigos')
            .setStyle(ButtonStyle.Secondary)
    );

    const msg = await interaction.editReply({ embeds: [embed], components: [row] });

    try {
        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && (i.customId === 'salv_config_tipo_ficha' || i.customId === 'salv_config_tipo_npc'),
            time: 300000
        });

        collector.on('collect', async i => {
            if (!i.deferred && !i.replied) {
                try { await i.deferUpdate(); } catch (e) {}
            }
            collector.stop();

            const isNpc = i.customId === 'salv_config_tipo_npc';

            if (isNpc) {
                const nomeSistema = obterSistemaAtivo() || 'Sistema Padrão';
                const contextoNpc = {
                    nomeSistema,
                    isNpc: true
                };
                return exibirMenuSubtiposConfig(i, contextoNpc);
            } else {
                const contexto = obterContextoAtivo(i.user.id, i.guild.id);
                if (contexto.erro) {
                    const embedErro = new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('❌ Erro de Contexto')
                        .setDescription(contexto.erro);
                    return i.editReply({ embeds: [embedErro], components: [] });
                }
                return exibirMenuSubtiposConfig(i, contexto);
            }
        });
    } catch (err) {
        console.error("Erro no coletor de tipo de configuração de salvaguarda:", err);
    }
}

module.exports = { iniciarConfiguracaoSalvaguarda };