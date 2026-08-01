const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

async function iniciarLootSelect(session) {
    session.step = 'AGUARDANDO_LOOT_SIM_NAO';
    const tipoNome = session.data.tipo === 'inimigo' ? 'Inimigo' : 'NPC';

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('criarficha_loot_sim').setLabel('Sim').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('criarficha_loot_nao').setLabel('Não').setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Criador de Fichas — Loot / Drop')
        .setDescription(`Este ${tipoNome} vai dropar algum item, arma, armadura ou dinheiro ao ser derrotado?`);

    await session.interaction.editReply({ embeds: [embed], components: [row] });
}

async function lidarComLootSimNao(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('criarficha_loot_')) return false;
    await interaction.deferUpdate();

    const session = require('./sessionCriarficha').getSession(interaction.user.id);
    session.interaction = interaction;
    const escolha = interaction.customId.replace('criarficha_loot_', '');

    if (escolha === 'nao') {
        const { pedirDescricaoAi } = require('./etapaDescricao');
        await pedirDescricaoAi(session);
        return true;
    }

    session.step = 'AGUARDANDO_LOOT_TIPOS_SELECT';
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('criarficha_loot_tipos_menu')
        .setPlaceholder('Selecione os tipos de loot...')
        .setMinValues(1)
        .setMaxValues(4)
        .addOptions([
            { label: 'Itens', value: 'itens', description: 'Cordas, velas, comida, etc.' },
            { label: 'Armas', value: 'armas', description: 'Armas com rolagem de dano' },
            { label: 'Armaduras', value: 'armaduras', description: 'Armaduras e CA' },
            { label: 'Dinheiro', value: 'dinheiro', description: 'Moedas e moedas customizadas' }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Criador de Fichas — Tipos de Loot')
        .setDescription('Selecione abaixo quais categorias de itens este ser poderá dropar (você pode selecionar mais de uma):');

    await interaction.editReply({ embeds: [embed], components: [row] });
    return true;
}

async function lidarComLootTiposMenu(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'criarficha_loot_tipos_menu') return false;
    await interaction.deferUpdate();

    const session = require('./sessionCriarficha').getSession(interaction.user.id);
    session.interaction = interaction;
    session.data.lootTipos = interaction.values;

    await processarProximoLootTipo(session);
    return true;
}

async function processarProximoLootTipo(session) {
    if (!session.data.lootTipos || session.data.lootTipos.length === 0) {
        const { pedirDescricaoAi } = require('./etapaDescricao');
        return await pedirDescricaoAi(session);
    }

    const proximo = session.data.lootTipos.shift();
    session.currentLootTipo = proximo;

    if (proximo === 'itens') {
        const { pedirItens } = require('./etapaLootItens');
        await pedirItens(session);
    } else if (proximo === 'armas') {
        const { iniciarArmas } = require('./etapaLootArmas');
        await iniciarArmas(session);
    } else if (proximo === 'armaduras') {
        const { iniciarArmaduras } = require('./etapaLootArmaduras');
        await iniciarArmaduras(session);
    } else if (proximo === 'dinheiro') {
        const { pedirDinheiro } = require('./etapaLootDinheiro');
        await pedirDinheiro(session);
    }
}

module.exports = {
    iniciarLootSelect,
    lidarComLootSimNao,
    lidarComLootTiposMenu,
    processarProximoLootTipo
};