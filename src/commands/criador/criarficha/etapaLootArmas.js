const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { armasDb } = require('../../tabelas/database/dbManager');

function buscarArmasTabela(guildId) {
    try {
        const rows = armasDb.prepare('SELECT * FROM armas WHERE guildId = ?').all(guildId);
        let results = [];
        const seen = new Set();

        for (const row of rows) {
            const nome = row.nome || '';
            if (nome && !seen.has(nome)) {
                seen.add(nome);
                results.push({
                    id: row.id, // Adicionado ID aqui
                    name: nome,
                    rolagem: row.dadoDano || 'Nenhum',
                    bonus: row.bonusDano || 'Nenhum',
                    descricao: row.descricao || '',
                    tipo: row.estilo || 'Melee'
                });
            }
        }
        return results;
    } catch (e) {
        console.error('Erro ao buscar armas:', e);
        return [];
    }
}

async function iniciarArmas(session) {
    const guildId = session.interaction.guild?.id;
    const armasTabela = buscarArmasTabela(guildId);
    
    session.tempArmasDisponiveis = armasTabela;
    session.tempArmasSelecionadas = [];
    session.tempArmaIndex = 0;

    const tipoNome = session.data.tipo === 'inimigo' ? 'Inimigo' : 'NPC';

    if (armasTabela.length === 0) {
        session.step = 'AGUARDANDO_ARMA_NOME_LIVRE';
        session.tempWeapon = {};
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🤖 Criador de Fichas — Loot: Armas')
            .setDescription(`Nenhuma arma encontrada cadastrada via \`/tabelas criar\`. Qual o **nome da arma** que o ${tipoNome} irá dropar?\n\n*Envie o nome na próxima mensagem.*`);
        await session.interaction.editReply({ embeds: [embed], components: [] });
        return;
    }

    session.step = 'AGUARDANDO_ARMAS_SELECT';
    const options = armasTabela.slice(0, 25).map(a => ({
        label: a.name.substring(0, 100),
        value: a.name.substring(0, 100)
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('criarficha_armas_select')
        .setPlaceholder('Selecione as armas que o NPC/Inimigo vai dropar...')
        .setMinValues(1)
        .setMaxValues(options.length)
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Criador de Fichas — Loot: Armas')
        .setDescription(`Selecione abaixo quais **armas** o ${tipoNome} poderá dropar ao morrer (você pode selecionar mais de uma):`);

    await session.interaction.editReply({ embeds: [embed], components: [row] });
}

async function lidarComArmasSelect(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'criarficha_armas_select') return false;
    await interaction.deferUpdate();

    const session = require('./sessionCriarficha').getSession(interaction.user.id);
    session.interaction = interaction;
    session.tempArmasSelecionadas = interaction.values;
    session.tempArmaIndex = 0;

    await perguntarProximaArma(session);
    return true;
}

async function perguntarProximaArma(session) {
    if (session.tempArmaIndex >= session.tempArmasSelecionadas.length) {
        const { processarProximoLootTipo } = require('./etapaLootSelect');
        await processarProximoLootTipo(session);
        return;
    }

    const weaponName = session.tempArmasSelecionadas[session.tempArmaIndex];
    const found = (session.tempArmasDisponiveis || []).find(a => a.name === weaponName) || { id: null, name: weaponName, rolagem: 'Nenhum', bonus: 'Nenhum', descricao: '', tipo: 'Melee' };
    
    session.tempCurrentWeapon = {
        id: found.id,
        nome: found.name,
        rolagem: found.rolagem,
        bonus: found.bonus,
        descricao: found.descricao,
        tipo: found.tipo
    };
    session.step = 'AGUARDANDO_ARMA_CHANCE';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🤖 Criador de Fichas — Loot: Arma (${session.tempArmaIndex + 1}/${session.tempArmasSelecionadas.length})`)
        .setDescription(`Qual a **chance** da arma **${weaponName}** ser dropada? (0% a 100%)\n\n*Envie o número na próxima mensagem.*`);

    await session.interaction.editReply({ embeds: [embed], components: [] });
}

async function processarArmaTexto(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    if (session.step === 'AGUARDANDO_ARMA_NOME_LIVRE') {
        session.tempWeapon.nome = texto;
        session.step = 'AGUARDANDO_ARMA_CHANCE_LIVRE';
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🤖 Criador de Fichas — Chance da Arma').setDescription('Qual a porcentagem de drop desta arma? (0% a 100%)');
        await session.interaction.editReply({ embeds: [embed], components: [] });
        return;
    }

    if (session.step === 'AGUARDANDO_ARMA_CHANCE_LIVRE') {
        session.tempWeapon.chance = texto;
        if (!session.data.armasDrop) session.data.armasDrop = [];
        session.data.armasDrop.push({ ...session.tempWeapon });
        
        const { processarProximoLootTipo } = require('./etapaLootSelect');
        await processarProximoLootTipo(session);
        return;
    }

    if (session.step === 'AGUARDANDO_ARMA_CHANCE') {
        session.tempCurrentWeapon.chance = texto;
        if (!session.data.armasDrop) session.data.armasDrop = [];
        session.data.armasDrop.push({ ...session.tempCurrentWeapon });

        session.tempArmaIndex++;
        await perguntarProximaArma(session);
        return;
    }
}

async function lidarComArmasBotoes(interaction) {
    return false;
}

module.exports = {
    iniciarArmas,
    lidarComArmasSelect,
    processarArmaTexto,
    lidarComArmasBotoes
};