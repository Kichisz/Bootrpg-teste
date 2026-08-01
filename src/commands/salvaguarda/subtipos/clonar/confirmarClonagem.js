const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function confirmarAvisoClonagem(interaction, sistemaOrigem, listaOrigem, sistemaAtual) {
    const embed = new EmbedBuilder()
        .setTitle('⚠️ Aviso Importante de Clonagem')
        .setDescription(`Você está prestes a copiar a lista de subtipos **"${listaOrigem}"** do sistema **"${sistemaOrigem}"** para o sistema ativo atualmente (**"${sistemaAtual}"**).\n\n⚠️ **Atenção:** Isso **excluirá todos os subtipos criados por você atualmente no sistema ${sistemaAtual}**, substituindo-os pelos clonados.\n\nDeseja mesmo fazer isso?`)
        .setColor(0xED4245);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`salv_clone_sim_${sistemaOrigem}__${listaOrigem}__${sistemaAtual}`)
            .setLabel('Sim, clonar e substituir')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`salv_clone_nao_${sistemaAtual}`)
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({ embeds: [embed], components: [row] });
}

module.exports = { confirmarAvisoClonagem };