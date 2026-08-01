const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../database/dbManager');

async function perguntarPunicaoPeso(context, session) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚖️ Punição por Excesso de Peso')
        .setDescription('Após atingir o valor máximo, como deveremos aplicar punição para quem tentar carregar mais?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('inv_config_punicao_escolha')
            .setPlaceholder('Escolha o tipo de punição...')
            .addOptions([
                { label: 'Penalidade de atributos por excesso', description: 'Tira -1 nos atributos a cada X% acima (acumulativo)', value: 'penalidade' },
                { label: 'Impedir de pegar itens', description: 'Bloqueia totalmente pegar itens que ultrapassem o peso máximo', value: 'impedir' }
            ])
    );

    if (context.channel && typeof context.channel.send === 'function') {
        await context.channel.send({ embeds: [embed], components: [row] });
    } else if (typeof context.update === 'function') {
        await context.update({ embeds: [embed], components: [row] });
    } else {
        await context.reply({ embeds: [embed], components: [row] });
    }
}

async function processarPunicaoTexto(message, session) {
    if (!session.waitingForPenalidadeValor) return false;

    const texto = message.content.trim();
    const sistemaNome = session.sistemaNome;
    let pesoConfig = dbManager.carregarPesoSistema(sistemaNome) || {};

    pesoConfig.penalidadeValor = texto; // Ex: "10" (para cada 10% acima, -1 acumulativo)
    session.waitingForPenalidadeValor = false;
    
    try { await message.delete(); } catch (e) {}

    dbManager.salvarPesoSistema(sistemaNome, pesoConfig);

    const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ Configuração de Peso Concluída')
        .setDescription(`O sistema de peso para **${sistemaNome}** foi configurado com sucesso!\n\n⚖️ **Regra de Penalidade:** A cada **${texto}%** acima do peso máximo, os atributos sofrerão **-1 cumulativo** (ex: 10% = -1, 20% = -2, etc.).`);
    
    await message.channel.send({ embeds: [embed] });
    return true;
}

module.exports = { perguntarPunicaoPeso, processarPunicaoTexto };