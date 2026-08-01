const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { obterListaAtiva, getDb } = require('../subtipos/database/dbConnection');
const { getSalvaguardaDb, getSalvaguardaNpcsDb } = require('./dbConfig'); // 👈 Importa o banco de salvaguarda correto
const { setConfigTemp } = require('./salvaguardaStore');

async function exibirMenuSubtiposConfig(interaction, contexto) {
    if (contexto.isNpc) {
        setConfigTemp(interaction.user.id, '_temp_is_npc', { isNpc: true, sistemaNome: contexto.nomeSistema });
    } else {
        setConfigTemp(interaction.user.id, '_temp_is_npc', { isNpc: false });
    }

    const dadosAtivos = obterListaAtiva(contexto.nomeSistema);
    let nomeListaAtiva = dadosAtivos.nomeLista || 'Geral';
    let subtipos = dadosAtivos.itens || [];

    if (!subtipos || subtipos.length === 0) {
        try {
            const db = getDb();
            subtipos = db.prepare('SELECT tipo, subtipo FROM subtipos_salvaguarda WHERE sistema = ?').all(contexto.nomeSistema);
            db.close();
        } catch (e) {}
    }

    if (!subtipos || subtipos.length === 0) {
        subtipos = [
            { tipo: 'Físico', subtipo: 'Cinético' },
            { tipo: 'Mental', subtipo: 'Psíquico' }
        ];
    }

    let configsSalvas = [];
    if (contexto.isNpc) {
        const dbNpcs = getSalvaguardaNpcsDb();
        try {
            configsSalvas = dbNpcs.prepare(`
                SELECT subtipoChave FROM salvaguardanpcs_configs 
                WHERE userId = ? AND sistemaNome = ?
            `).all(interaction.user.id, contexto.nomeSistema);
        } catch (e) {}
        dbNpcs.close();
    } else {
        // Busca no banco correto de salvaguardas usando os mesmos parâmetros exatos do log
        const dbConfigs = getSalvaguardaDb();
        try {
            configsSalvas = dbConfigs.prepare(`
                SELECT subtipoChave FROM salvaguarda_configs 
                WHERE userId = ? AND sistemaNome = ? AND avatarNome = ? AND fichaId = ?
            `).all(interaction.user.id, contexto.nomeSistema, contexto.avatarNome, contexto.fichaId);
        } catch (e) {}
        dbConfigs.close();
    }

    const chavesConfiguradas = new Set(configsSalvas.map(c => String(c.subtipoChave).toLowerCase().trim()));

    const options = subtipos.map(s => {
        const tipoLimpo = (s.tipo || '').trim();
        const subtipoLimpo = (s.subtipo || '').trim();
        const chave = `${tipoLimpo}: ${subtipoLimpo}`;
        
        const chaveLower = chave.toLowerCase().trim();
        const configurado = chavesConfiguradas.has(chaveLower) || chavesConfiguradas.has(subtipoLimpo.toLowerCase().trim());
        
        const statusTexto = configurado ? '🟢 Configurado' : '🔴 Não configurado';
        
        return {
            label: chave.substring(0, 100),
            description: statusTexto.substring(0, 100),
            value: chave
        };
    });

    const embedDesc = contexto.isNpc
        ? `🟢 **Sistema Ativo:** \`${contexto.nomeSistema}\`\n` +
          `📂 **Lista de Subtipos Ativa:** \`${nomeListaAtiva}\`\n` +
          `🤖 **Modo:** \`NPCs / Inimigos (Genérico)\`\n\n` +
          '**Qual roll de salvaguarda deseja adicionar/modificar?**'
        : `🟢 **Sistema Ativo:** \`${contexto.nomeSistema}\`\n` +
          `📂 **Lista de Subtipos Ativa:** \`${nomeListaAtiva}\`\n` +
          `👤 **Avatar / Ficha:** \`${contexto.avatarNome}\`\n\n` +
          '**Qual roll de salvaguarda deseja adicionar/modificar?**';

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛡️ Configuração de Salvaguarda')
        .setDescription(embedDesc)
        .setFooter({ text: 'Selecione abaixo o subtipo desejado' });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('salv_config_select_subtipo')
        .setPlaceholder('Selecione um subtipo...')
        .addOptions(options.slice(0, 25));

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.editReply({ embeds: [embed], components: [row] });
}

module.exports = { exibirMenuSubtiposConfig };