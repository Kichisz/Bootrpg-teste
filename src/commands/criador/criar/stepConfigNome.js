const sessionCriador = require('./sessionCriador');
const { EmbedBuilder, MessageFlags } = require('discord.js');

async function iniciarConfiguracao(interaction) {
    const session = sessionCriador.getSession(interaction.user.id);
    session.step = 'AGUARDANDO_NOME';
    session.data = {};
    session.interactionRef = interaction; // Guarda a referência para atualizar a mensagem de forma privada

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛠️ Configuração do Criador - Nome')
        .setDescription(
            'Qual o **nome** deseja dar para essa configuração de NPCs/Inimigos?\n\n' +
            '**Como funciona:** Este nome servirá para você identificar e carregar este conjunto de regras futuramente.\n\n' +
            '> 📝 **Envie o nome desejado na próxima mensagem no chat:**'
        );

    // Responde de forma privada (efêmera) para só você ver
    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
}

async function processarNome(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    if (!texto) {
        if (session.interactionRef) {
            return session.interactionRef.followUp({ content: '❌ O nome não pode estar vazio.', flags: [MessageFlags.Ephemeral] });
        }
        return;
    }

    session.configName = texto;
    await sessionCriador.avancarProximoPasso(message, session);
}

module.exports = {
    iniciarConfiguracao,
    processarNome
};