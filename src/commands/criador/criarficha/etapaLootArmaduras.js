const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { armadurasDb } = require('../../tabelas/database/dbManager');

function buscarArmadurasTabela(guildId) {
    try {
        const rows = armadurasDb.prepare('SELECT * FROM armaduras WHERE guildId = ?').all(guildId);
        let results = [];
        const seen = new Set();

        for (const row of rows) {
            const nome = row.nome || '';
            if (nome && !seen.has(nome)) {
                seen.add(nome);
                results.push({
                    id: row.id, // Adicionado ID aqui
                    name: nome,
                    ca: row.bonusCa || 'Nenhum',
                    penalidade: row.penalidadeDestreza || 'Nenhuma',
                    descricao: row.descricao || ''
                });
            }
        }
        return results;
    } catch (e) {
        console.error('Erro ao buscar armaduras:', e);
        return [];
    }
}

async function iniciarArmaduras(session) {
    const guildId = session.interaction.guild?.id;
    const armadurasTabela = buscarArmadurasTabela(guildId);
    
    session.tempArmadurasDisponiveis = armadurasTabela;
    session.tempArmadurasSelecionadas = [];
    session.tempArmaduraIndex = 0;

    const tipoNome = session.data.tipo === 'inimigo' ? 'Inimigo' : 'NPC';

    if (armadurasTabela.length === 0) {
        session.step = 'AGUARDANDO_ARMADURA_NOME_LIVRE';
        session.tempArmor = {};
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🤖 Criador de Fichas — Loot: Armaduras')
            .setDescription(`Nenhuma armadura encontrada cadastrada via \`/tabelas criar\`. Qual o **nome da armadura** que o ${tipoNome} irá dropar?\n\n*Envie o nome na próxima mensagem.*`);
        await session.interaction.editReply({ embeds: [embed], components: [] });
        return;
    }

    session.step = 'AGUARDANDO_ARMADURAS_SELECT';
    const options = armadurasTabela.slice(0, 25).map(a => ({
        label: a.name.substring(0, 100),
        value: a.name.substring(0, 100)
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('criarficha_armaduras_select')
        .setPlaceholder('Selecione as armaduras que o NPC/Inimigo vai dropar...')
        .setMinValues(1)
        .setMaxValues(options.length)
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Criador de Fichas — Loot: Armaduras')
        .setDescription(`Selecione abaixo quais **armaduras** o ${tipoNome} poderá dropar ao morrer (você pode selecionar mais de uma):`);

    await session.interaction.editReply({ embeds: [embed], components: [row] });
}

async function lidarComArmadurasSelect(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'criarficha_armaduras_select') return false;
    await interaction.deferUpdate();

    const session = require('./sessionCriarficha').getSession(interaction.user.id);
    session.interaction = interaction;
    session.tempArmadurasSelecionadas = interaction.values;
    session.tempArmaduraIndex = 0;

    await perguntarProximaArmadura(session);
    return true;
}

async function perguntarProximaArmadura(session) {
    if (session.tempArmaduraIndex >= session.tempArmadurasSelecionadas.length) {
        const { processarProximoLootTipo } = require('./etapaLootSelect');
        await processarProximoLootTipo(session);
        return;
    }

    const armorName = session.tempArmadurasSelecionadas[session.tempArmaduraIndex];
    const found = (session.tempArmadurasDisponiveis || []).find(a => a.name === armorName) || { id: null, name: armorName, ca: 'Nenhum', penalidade: 'Nenhuma', descricao: '' };

    session.tempCurrentArmor = {
        id: found.id,
        nome: found.name,
        ca: found.ca,
        penalidade: found.penalidade,
        descricao: found.descricao
    };
    session.step = 'AGUARDANDO_ARMADURA_CHANCE';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🤖 Criador de Fichas — Loot: Armadura (${session.tempArmaduraIndex + 1}/${session.tempArmadurasSelecionadas.length})`)
        .setDescription(`Qual a **chance** da armadura **${armorName}** ser dropada? (0% a 100%)\n\n*Envie o número na próxima mensagem.*`);

    await session.interaction.editReply({ embeds: [embed], components: [] });
}

async function processarArmaduraTexto(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    if (session.step === 'AGUARDANDO_ARMADURA_NOME_LIVRE') {
        session.tempArmor.nome = texto;
        session.step = 'AGUARDANDO_ARMADURA_CHANCE_LIVRE';
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🤖 Criador de Fichas — Chance da Armadura').setDescription('Qual a porcentagem de drop desta armadura? (0% a 100%)');
        await session.interaction.editReply({ embeds: [embed], components: [] });
        return;
    }

    if (session.step === 'AGUARDANDO_ARMADURA_CHANCE_LIVRE') {
        session.tempArmor.chance = texto;
        if (!session.data.armadurasDrop) session.data.armadurasDrop = [];
        session.data.armadurasDrop.push({ ...session.tempArmor });

        const { processarProximoLootTipo } = require('./etapaLootSelect');
        await processarProximoLootTipo(session);
        return;
    }

    if (session.step === 'AGUARDANDO_ARMADURA_CHANCE') {
        session.tempCurrentArmor.chance = texto;
        if (!session.data.armadurasDrop) session.data.armadurasDrop = [];
        session.data.armadurasDrop.push({ ...session.tempCurrentArmor });

        session.tempArmaduraIndex++;
        await perguntarProximaArmadura(session);
        return;
    }
}

async function lidarComArmadurasBotoes(interaction) {
    return false;
}

module.exports = {
    iniciarArmaduras,
    lidarComArmadurasSelect,
    processarArmaduraTexto,
    lidarComArmadurasBotoes
};