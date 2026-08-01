const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { itensDb } = require('../../tabelas/database/dbManager');

function buscarItensTabela(guildId) {
    try {
        const rows = itensDb.prepare('SELECT * FROM itens WHERE guildId = ?').all(guildId);
        let results = [];
        const seen = new Set();

        for (const row of rows) {
            const nome = row.nome || '';
            if (nome && !seen.has(nome)) {
                seen.add(nome);
                results.push({ id: row.id, name: nome, peso: row.peso }); // Adicionado ID aqui
            }
        }
        return results;
    } catch (e) {
        console.error('Erro ao buscar itens:', e);
        return [];
    }
}

async function pedirItens(session) {
    const guildId = session.interaction.guild?.id;
    const itensTabela = buscarItensTabela(guildId);
    
    session.tempItensDisponiveis = itensTabela;
    session.tempItensSelecionados = [];
    session.tempItemIndex = 0;

    const tipoNome = session.data.tipo === 'inimigo' ? 'Inimigo' : 'NPC';

    if (itensTabela.length === 0) {
        session.step = 'AGUARDANDO_ITENS_TEXTO_LIVRE';
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🤖 Criador de Fichas — Loot: Itens')
            .setDescription(`Nenhum item comum encontrado cadastrado via \`/tabelas criar\`. Escreva o nome dos **itens** que o ${tipoNome} irá dropar e a porcentagem ao lado (Ex: \`Corda:75, Isqueiro:10\`):`);
        await session.interaction.editReply({ embeds: [embed], components: [] });
        return;
    }

    session.step = 'AGUARDANDO_ITENS_SELECT';
    const options = itensTabela.slice(0, 25).map(it => ({
        label: it.name.substring(0, 100),
        value: it.name.substring(0, 100)
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('criarficha_itens_select')
        .setPlaceholder('Selecione os itens que o NPC/Inimigo vai dropar...')
        .setMinValues(1)
        .setMaxValues(options.length)
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Criador de Fichas — Loot: Itens')
        .setDescription(`Selecione abaixo quais **itens comuns** o ${tipoNome} poderá dropar ao morrer (você pode selecionar mais de uma):`);

    await session.interaction.editReply({ embeds: [embed], components: [row] });
}

async function lidarComItensSelect(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'criarficha_itens_select') return false;
    await interaction.deferUpdate();

    const session = require('./sessionCriarficha').getSession(interaction.user.id);
    session.interaction = interaction;
    session.tempItensSelecionados = interaction.values;
    session.tempItemIndex = 0;

    await perguntarProximoItem(session);
    return true;
}

async function perguntarProximoItem(session) {
    if (session.tempItemIndex >= session.tempItensSelecionados.length) {
        const { processarProximoLootTipo } = require('./etapaLootSelect');
        await processarProximoLootTipo(session);
        return;
    }

    const itemName = session.tempItensSelecionados[session.tempItemIndex];
    const found = (session.tempItensDisponiveis || []).find(i => i.name === itemName);
    
    session.tempCurrentItem = { 
        id: found ? found.id : null, 
        nome: itemName 
    };
    session.step = 'AGUARDANDO_ITEM_CHANCE';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🤖 Criador de Fichas — Loot: Item (${session.tempItemIndex + 1}/${session.tempItensSelecionados.length})`)
        .setDescription(`Qual a **chance** de dropar o item **${itemName}**?\n\n*Escreva o número em porcentagem (Ex: \`10\` ou \`10%\`).*`);

    await session.interaction.editReply({ embeds: [embed], components: [] });
}

async function processarItensTexto(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    if (session.step === 'AGUARDANDO_ITENS_TEXTO_LIVRE') {
        session.data.itensDrop = texto;
        const { processarProximoLootTipo } = require('./etapaLootSelect');
        await processarProximoLootTipo(session);
        return;
    }

    if (session.step === 'AGUARDANDO_ITEM_CHANCE') {
        session.tempCurrentItem.chance = texto;
        session.step = 'AGUARDANDO_ITEM_QTD';

        const itemName = session.tempCurrentItem.nome;
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🤖 Criador de Fichas — Loot: Item (${session.tempItemIndex + 1}/${session.tempItensSelecionados.length})`)
            .setDescription(`Quantos **máximo** podem ser dropados de **${itemName}**?\n\n*Exemplo: \`10\` (para até 10 unidades).*`);

        await session.interaction.editReply({ embeds: [embed], components: [] });
        return;
    }

    if (session.step === 'AGUARDANDO_ITEM_QTD') {
        session.tempCurrentItem.maxQtd = texto;
        
        if (!session.data.itensDropArray) session.data.itensDropArray = [];
        session.data.itensDropArray.push({ ...session.tempCurrentItem });

        session.data.itensDrop = session.data.itensDropArray.map(i => `${i.name || i.nome}:${i.chance} (Max: ${i.maxQtd}) [ID: ${i.id || 'N/A'}]`).join(', ');

        session.tempItemIndex++;
        await perguntarProximoItem(session);
        return;
    }
}

module.exports = {
    pedirItens,
    lidarComItensSelect,
    processarItensTexto
};