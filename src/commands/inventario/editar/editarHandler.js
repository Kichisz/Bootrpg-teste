const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const inventarioConfig = require('../inventarioConfig');
const darItem = require('./darItem');
const excluirItem = require('./excluirItem');
const editarItem = require('./editarItem');

const sessionMap = new Map();

function getFichasDb() {
    const rootDir = path.resolve('.');
    const arquivos = fs.readdirSync(rootDir);
    const dbs = arquivos.filter(file => file.endsWith('.sqlite') || file.endsWith('.db'));

    for (const file of dbs) {
        if (file === 'sistemaativo-database.sqlite' || file === 'sistemainventarioconfig-database.sqlite' || file === 'pesoconfig-database.sqlite' || file === 'inventarioplayers-database.sqlite' || file === 'Itenstabela-database.sqlite' || file === 'Armastabela-database.sqlite' || file === 'Armadurasstabela-database.sqlite') {
            continue;
        }
        try {
            const dbTest = new Database(path.join(rootDir, file), { readonly: true });
            const tableCheck = dbTest.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fichas'").get();
            if (tableCheck) {
                dbTest.close();
                return new Database(path.join(rootDir, file));
            }
            dbTest.close();
        } catch (e) {}
    }

    try {
        return new Database(path.resolve('fichas.sqlite'));
    } catch (e) {
        return new Database(path.resolve('database.sqlite'));
    }
}

async function editarHandler(interaction) {
    const isGm = interaction.member && interaction.member.roles && interaction.member.roles.cache.some(r => r.name.toLowerCase() === 'gm');
    if (!isGm) {
        if (!interaction.deferred && !interaction.replied) {
            return interaction.reply({ content: '❌ Você não é o GM!', flags: [MessageFlags.Ephemeral] });
        } else {
            return interaction.editReply({ content: '❌ Você não é o GM!' });
        }
    }

    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const usuarioAlvo = interaction.options.getUser('usuario');
    if (!usuarioAlvo) {
        return interaction.editReply({ content: '❌ Você deve obrigatoriamente marcar a pessoa que vai editar o inventário (ex: `/inventario editar @usuario`).' });
    }
    const userId = usuarioAlvo.id;

    // 1. Obtém o sistema ativo atual no servidor
    const sistemaAtivoObj = inventarioConfig.getSistemaAtivo();
    const sistemaAtivoNome = sistemaAtivoObj?.nomeSistema || sistemaAtivoObj?.nome || sistemaAtivoObj?.sistema || null;

    if (!sistemaAtivoNome) {
        return interaction.editReply({ 
            content: '❌ Não foi possível identificar o **sistema RPG ativo** atualmente no servidor.' 
        });
    }

    let db;
    try {
        db = getFichasDb();
    } catch (err) {
        return interaction.editReply({ 
            content: '❌ Erro ao conectar com o banco de dados de fichas.' 
        });
    }

    try {
        // 2. Busca todas as fichas do usuário alvo
        const fichas = db.prepare('SELECT * FROM fichas WHERE userId = ?').all(userId);
        db.close();

        if (!fichas || fichas.length === 0) {
            return interaction.editReply({ 
                content: `❌ O usuário <@${userId}> não possui nenhuma ficha cadastrada.` 
            });
        }

        // 3. Filtra pela ficha do sistema ativo ou pega a primeira como fallback
        let fichaAlvo = fichas.find(f => 
            f.sistemaNome && 
            f.sistemaNome.toLowerCase().trim() === sistemaAtivoNome.toLowerCase().trim()
        );

        if (!fichaAlvo) {
            fichaAlvo = fichas[0];
        }

        let dadosFicha = {};
        try {
            dadosFicha = JSON.parse(fichaAlvo.dadosJson || '{}');
        } catch (e) {
            dadosFicha = {};
        }

        const nomePersonagem = dadosFicha.informacoesGerais?.nome || fichaAlvo.nomePersonagem || 'Personagem';
        const avatarNome = fichaAlvo.avatarNome || 'Desconhecido';
        const fichaId = fichaAlvo.id || fichaAlvo.rowid || userId;

        // Salva na sessão
        sessionMap.set(interaction.user.id, { targetUserId: userId, fichaId, nomePersonagem, avatarNome, sistemaAtivoNome });

        const embed = new EmbedBuilder()
            .setTitle(`🛠️ Editando Inventário: ${nomePersonagem} (${avatarNome})`)
            .setDescription(`**Sistema Ativo:** ${sistemaAtivoNome}\n**Usuário:** <@${userId}>\n\nQuais modificações deseja fazer no inventário de **<@${userId}> | ${nomePersonagem}**?`)
            .setColor(0xFEE75C)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`inventario_editar_menu_${userId}`)
                .setPlaceholder('Selecione a ação desejada...')
                .addOptions([
                    { label: 'Dar item', value: 'dar', description: 'Adiciona itens, armas ou armaduras do sistema', emoji: '🎁' },
                    { label: 'Excluir item', value: 'excluir', description: 'Remove itens do inventário', emoji: '🗑️' },
                    { label: 'Editar item', value: 'editar', description: 'Modifica quantidade, dano, peso, etc.', emoji: '✏️' }
                ])
        );

        return interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
        if (db && db.open) db.close();
        console.error('Erro no editarHandler de inventário:', error);
        return interaction.editReply({ 
            content: '❌ Ocorreu um erro interno ao tentar abrir o painel de edição do inventário.' 
        });
    }
}

async function handleInteractions(interaction) {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return false;
    const customId = interaction.customId;

    if (customId && customId.startsWith('inventario_editar_menu_')) {
        const acao = interaction.values[0];
        const session = sessionMap.get(interaction.user.id);

        if (!session) {
            return interaction.reply({ content: '⚠️ Sessão expirada. Por favor, execute o comando `/inventario editar` novamente.', flags: [MessageFlags.Ephemeral] });
        }

        if (acao === 'dar') {
            return darItem.iniciar(interaction, session.targetUserId, session.fichaId, session.sistemaAtivoNome);
        } else if (acao === 'excluir') {
            return excluirItem.iniciar(interaction, session.targetUserId, session.fichaId);
        } else if (acao === 'editar') {
            return editarItem.iniciar(interaction, session.targetUserId, session.fichaId);
        }
    }

    if (await darItem.handleInteractions(interaction)) return true;
    if (await excluirItem.handleInteractions(interaction)) return true;
    if (await editarItem.handleInteractions(interaction)) return true;

    return false;
}

async function handleMessages(message) {
    if (await darItem.handleMessages(message)) return true;
    if (await editarItem.handleMessages(message)) return true;
    return false;
}

module.exports = editarHandler;
module.exports.handleInteractions = handleInteractions;
module.exports.handleMessages = handleMessages;