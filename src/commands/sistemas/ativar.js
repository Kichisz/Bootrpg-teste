const { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database');
const Database = require('better-sqlite3');

// Armazena temporariamente os dados da ativação pendente por usuário
const pendingActivations = new Map();

// Função auxiliar para criar o banco "sistemaativo-database.sqlite" e salvar os dados do sistema ativo
function salvarSistemaAtivoNoSqlite(sys, interaction) {
    try {
        const configData = JSON.parse(sys.config || '{}');
        const sistemaAtivoObj = {
            nomeSistema: sys.nomeSistema || sys.nome || 'Sistema RPG',
            Criador: interaction.user.username,
            ...configData
        };

        const activeDb = new Database('sistemaativo-database.sqlite');
        activeDb.prepare(`
            CREATE TABLE IF NOT EXISTS sistema_ativo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conteudo_json TEXT
            )
        `).run();

        // Limpa registros anteriores e insere o novo sistema ativo
        activeDb.prepare('DELETE FROM sistema_ativo').run();
        activeDb.prepare('INSERT INTO sistema_ativo (conteudo_json) VALUES (?)').run(JSON.stringify(sistemaAtivoObj, null, 2));
        activeDb.close();
    } catch (err) {
        console.error('Erro ao salvar sistema ativo no sqlite:', err);
    }
}

async function iniciarAtivacao(interaction) {
    await interaction.deferReply({ flags: [64] });

    const sistemas = db.prepare('SELECT * FROM rpg_systems WHERE userId = ?').all(interaction.user.id);
    if (!sistemas || sistemas.length === 0) {
        return interaction.editReply({ content: '⚠️ Você não possui nenhum sistema de RPG cadastrado para ativar.' });
    }

    const options = sistemas.slice(0, 25).map(sys => {
        const nome = sys.nome || sys.nomeSistema || 'Sistema RPG';
        return {
            label: nome.substring(0, 100),
            value: String(sys.id)
        };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`ativar_select_${interaction.user.id}`)
        .setPlaceholder('Selecione o sistema que deseja ativar para este servidor...')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('🟢 Ativar Sistema de RPG')
        .setDescription('Selecione abaixo qual sistema deseja ativar para este servidor:');

    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleInteractions(interaction) {
    const customId = interaction.customId;
    if (!customId) return false;

    // 1. Seleção do sistema no dropdown
    if (interaction.isStringSelectMenu() && customId.startsWith('ativar_select_')) {
        const userId = customId.replace('ativar_select_', '');
        if (interaction.user.id !== userId) {
            return interaction.reply({ content: '❌ Esta interação não é sua.', flags: [64] });
        }

        await interaction.deferUpdate();
        const systemId = interaction.values[0];
        
        const sys = db.prepare('SELECT * FROM rpg_systems WHERE id = ? AND userId = ?').get(systemId, interaction.user.id);

        if (!sys) {
            return interaction.editReply({ content: '❌ Sistema não encontrado ou você não tem permissão para usá-lo.', embeds: [], components: [] });
        }

        const systemName = sys.nome || sys.nomeSistema || 'Sistema RPG';

        // Verificar se já existe um sistema ativo no servidor
        const activeRow = db.prepare('SELECT systemId FROM guild_active_system WHERE guildId = ?').get(interaction.guild.id);

        if (activeRow) {
            const currentSys = db.prepare('SELECT * FROM rpg_systems WHERE id = ?').get(activeRow.systemId);
            const currentName = currentSys ? (currentSys.nome || currentSys.nomeSistema || 'Sistema Anterior') : 'Sistema Anterior';

            if (String(activeRow.systemId) === String(systemId)) {
                const embed = new EmbedBuilder()
                    .setColor('#F1C40F')
                    .setTitle('⚠️ Sistema Já Ativo')
                    .setDescription(`sistema ativo: **${systemName}**\n\nEste sistema já é o sistema ativo atual deste servidor!`);
                return interaction.editReply({ embeds: [embed], components: [] });
            }

            pendingActivations.set(userId, { systemId, systemName });

            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('⚠️ Substituir Sistema Ativo')
                .setDescription(`sistema ativo: **${currentName}**\n\nDeseja mesmo ativar o sistema **${systemName}** e sobrepor o atual (**${currentName}**)?`);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ativar_conf_sim_${userId}`).setLabel('Sim').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`ativar_conf_nao_${userId}`).setLabel('Não').setStyle(ButtonStyle.Danger)
            );

            return interaction.editReply({ embeds: [embed], components: [row] });
        } else {
            // Se não há sistema ativo, ativa diretamente
            db.prepare('INSERT INTO guild_active_system (guildId, systemId) VALUES (?, ?) ON CONFLICT(guildId) DO UPDATE SET systemId = ?')
              .run(interaction.guild.id, systemId, systemId);

            // Copia e salva no sqlite 'sistemaativo-database.sqlite'
            salvarSistemaAtivoNoSqlite(sys, interaction);

            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('🟢 Sistema Ativado')
                .setDescription(`sistema ativo: **${systemName}**\n\nO sistema foi ativado com sucesso para este servidor!`);

            return interaction.editReply({ embeds: [embed], components: [] });
        }
    }

    // 2. Confirmação de sobreposição (Sim / Não)
    if (interaction.isButton() && (customId.startsWith('ativar_conf_sim_') || customId.startsWith('ativar_conf_nao_'))) {
        const isSim = customId.startsWith('ativar_conf_sim_');
        const userId = customId.replace(isSim ? 'ativar_conf_sim_' : 'ativar_conf_nao_', '');

        if (interaction.user.id !== userId) {
            return interaction.reply({ content: '❌ Esta interação não é sua.', flags: [64] });
        }

        await interaction.deferUpdate();
        const activationData = pendingActivations.get(userId);

        if (!activationData) {
            return interaction.editReply({ content: '⚠️ Sessão expirada.', embeds: [], components: [] });
        }

        if (!isSim) {
            pendingActivations.delete(userId);
            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Cancelado')
                .setDescription('A ativação do novo sistema foi cancelada.');
            return interaction.editReply({ embeds: [embed], components: [] });
        }

        // Ativar o novo sistema sobrepondo o anterior
        pendingActivations.delete(userId);
        db.prepare('INSERT INTO guild_active_system (guildId, systemId) VALUES (?, ?) ON CONFLICT(guildId) DO UPDATE SET systemId = ?')
          .run(interaction.guild.id, activationData.systemId, activationData.systemId);

        // Busca o sistema ativado para salvar no sqlite
        const sysAtivo = db.prepare('SELECT * FROM rpg_systems WHERE id = ?').get(activationData.systemId);
        if (sysAtivo) {
            salvarSistemaAtivoNoSqlite(sysAtivo, interaction);
        }

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🟢 Sistema Ativado com Sucesso')
            .setDescription(`sistema ativo: **${activationData.systemName}**\n\nO sistema anterior foi substituído e este agora é o sistema ativo do servidor!`);

        return interaction.editReply({ embeds: [embed], components: [] });
    }

    return false;
}

module.exports = {
    iniciarAtivacao,
    handleInteractions
};