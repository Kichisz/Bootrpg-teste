const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

async function exibir(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛡️ Passo 1/12 — Escolha o Tipo de Personagem')
        .setDescription(
            'Bem-vindo ao assistente interativo de criação de fichas!\n\n' +
            'Primeiramente, você precisa definir qual é a natureza desta ficha dentro do universo do RPG:\n\n' +
            '• **Personagem de Player (`--`)**: Ficha principal vinculada a um avatar seu, ideal para jogadores ativos.\n' +
            '• **Inimigo ou NPC (`----`)**: Ficha de suporte para monstros, criaturas ou personagens controlados pelo narrador/sistema.'
        );

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ficha_setup_tipo')
            .setPlaceholder('Selecione a categoria da ficha...')
            .addOptions([
                { label: 'Personagem Jogador ( -- )', value: 'personagem', description: 'Vincule a um avatar próprio.' },
                { label: 'Inimigo / NPC ( ---- )', value: 'inimigo_npc', description: 'Criatura ou NPC sem avatar fixo.' }
            ])
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function tratar(interaction, session) {
    if (interaction.customId !== 'ficha_setup_tipo') return false;
    
    const tipo = interaction.values[0];
    session.data.tipoPersonagem = tipo;

    if (tipo === 'personagem') {
        session.etapaAtual = 'avatar';
        const fichaAvatar = require('./fichaAvatar');
        return fichaAvatar.exibir(interaction, session);
    } else {
        session.data.avatarNome = 'NPC / Inimigo';
        session.etapaAtual = 'nome';
        const fichaNome = require('./fichaNome');
        return fichaNome.exibir(interaction, session);
    }
}

module.exports = { exibir, tratar };