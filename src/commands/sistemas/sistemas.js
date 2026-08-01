const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const sessionManager = require('./criar/sessionManager');
const db = require('../../database');
const compartilharHandler = require('./compartilhar');
const ativarHandler = require('./ativar');

const pendingDeletions = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sistemas')
        .setDescription('Gerenciamento de sistemas de RPG')
        .addSubcommand(sub =>
            sub.setName('criar')
               .setDescription('Inicia a criação de um novo sistema de RPG')
        )
        .addSubcommand(sub =>
            sub.setName('ver')
               .setDescription('Visualiza os seus sistemas de RPG criados')
        )
        .addSubcommand(sub =>
            sub.setName('ativar')
               .setDescription('Ativa um sistema de RPG para o servidor')
        )
        .addSubcommand(sub =>
            sub.setName('ativo')
               .setDescription('Mostra o sistema de RPG atualmente ativo no servidor')
        )
        .addSubcommand(sub =>
            sub.setName('compartilhar')
               .setDescription('Compartilha um sistema de RPG com outro usuário')
               .addUserOption(opt => opt.setName('usuario').setDescription('Usuário que receberá o sistema').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('deletar')
               .setDescription('Deleta um ou mais sistemas de RPG criados por você')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'criar') {
            if (typeof sessionManager.iniciarCriacao === 'function') {
                return await sessionManager.iniciarCriacao(interaction);
            }
            const session = sessionManager.getSession(interaction.user.id);
            session.data = {};
            sessionManager.resetarFlagsTexto(session);

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🛠️ Criação de Sistema de RPG')
                .setDescription(
                    'Para começarmos, digite aqui no chat o **nome oficial** que o seu sistema de RPG vai ter.\n\n' +
                    '💡 *Exemplo: "Crônicas de Arton", "Ordem Sobrevivência".* Envie apenas o nome na sua próxima mensagem!'
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
            sessionManager.salvarMensagemAtual(session, interaction);
            session.waitingForName = true;
            return;
        }

        if (subcommand === 'ver') {
            try {
                // Consulta real no banco de dados pelos sistemas do usuário
                const sistemas = db.prepare('SELECT * FROM rpg_systems WHERE userId = ?').all(interaction.user.id);
                
                if (!sistemas || sistemas.length === 0) {
                    return await interaction.reply({ content: '❌ Você ainda não criou nenhum sistema de RPG. Use `/sistemas criar` para começar!', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('📜 Seus Sistemas de RPG')
                    .setDescription('Selecione abaixo no menu o sistema que deseja visualizar os detalhes:');

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('rpg_ver_detalhes')
                    .setPlaceholder('Escolha um sistema...')
                    .addOptions(
                        sistemas.map(s => ({
                            label: (s.nomeSistema || s.nome || 'Sistema').substring(0, 100),
                            value: String(s.id)
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            } catch (err) {
                console.error('Erro ao buscar sistemas:', err);
                await interaction.reply({ content: '❌ Ocorreu um erro ao buscar seus sistemas.', ephemeral: true });
            }
            return;
        }

        if (subcommand === 'ativar') {
            return await ativarHandler.iniciarAtivacao(interaction);
        }

        if (subcommand === 'ativo') {
            try {
                const activeRow = db.prepare('SELECT systemId FROM guild_active_system WHERE guildId = ?').get(interaction.guild.id);
                if (!activeRow) {
                    return await interaction.reply({ content: '⚠️ Não há nenhum sistema de RPG ativo neste servidor no momento.', ephemeral: true });
                }

                const sys = db.prepare('SELECT * FROM rpg_systems WHERE id = ?').get(activeRow.systemId);
                if (!sys) {
                    return await interaction.reply({ content: '❌ O sistema ativo foi encontrado no registro, mas não existe mais no banco de dados.', ephemeral: true });
                }

                const nomeSistema = sys.nome || sys.nomeSistema || 'Sistema RPG';
                const isOwner = String(sys.userId) === String(interaction.user.id);

                let criadorNome = `<@${sys.userId}>`;
                try {
                    const member = await interaction.guild.members.fetch(sys.userId).catch(() => null);
                    if (member) criadorNome = member.user.tag;
                } catch (e) {}

                if (!isOwner) {
                    const embed = new EmbedBuilder()
                        .setColor('#3498DB')
                        .setTitle('🟢 Sistema Ativo do Servidor')
                        .setDescription(`**Nome do Sistema:** ${nomeSistema}\n**Criador:** ${criadorNome}`);
                    
                    return await interaction.reply({ embeds: [embed], ephemeral: true });
                } else {
                    let configStr = '{}';
                    try {
                        const parsedConfig = JSON.parse(sys.config || '{}');
                        configStr = JSON.stringify(parsedConfig, null, 2);
                    } catch (e) {
                        configStr = sys.config || '{}';
                    }

                    const embed = new EmbedBuilder()
                        .setColor('#57F287')
                        .setTitle(`🟢 Sistema Ativo: ${nomeSistema}`)
                        .setDescription(`**Criador:** ${criadorNome}\n\n**Tabela de Configuração:**\n\`\`\`json\n${configStr}\n\`\`\``);

                    return await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            } catch (err) {
                console.error('Erro ao buscar sistema ativo:', err);
                return await interaction.reply({ content: '❌ Ocorreu um erro ao verificar o sistema ativo.', ephemeral: true });
            }
        }

        if (subcommand === 'compartilhar') {
            return await compartilharHandler.iniciarCompartilhamento(interaction);
        }

        if (subcommand === 'deletar') {
            await interaction.deferReply({ ephemeral: true });

            const sistemas = db.prepare('SELECT * FROM rpg_systems WHERE userId = ?').all(interaction.user.id);

            if (!sistemas || sistemas.length === 0) {
                return interaction.editReply({ content: '⚠️ Você não possui nenhum sistema cadastrado para deletar.' });
            }

            const options = sistemas.slice(0, 25).map((sys, index) => {
                const nome = sys.nome || sys.nomeSistema || `Sistema ${index + 1}`;
                return new StringSelectMenuOptionBuilder()
                    .setLabel(nome.substring(0, 100))
                    .setValue(String(sys.id));
            });

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('deletar_sistema_select')
                    .setPlaceholder('Selecione os sistemas que quer deletar...')
                    .setMinValues(1)
                    .setMaxValues(Math.min(options.length, 25))
                    .addOptions(options)
            );

            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('🗑️ Deletar Sistemas de RPG')
                .setDescription('Selecione abaixo **um ou mais sistemas** que você deseja excluir permanentemente do banco de dados:');

            return interaction.editReply({ embeds: [embed], components: [row] });
        }
    },

    async handleInteractions(interaction) {
        if (interaction.customId?.startsWith('compartilhar_')) {
            return await compartilharHandler.handleInteractions(interaction);
        }

        if (interaction.customId?.startsWith('ativar_')) {
            return await ativarHandler.handleInteractions(interaction);
        }

        // Exibe os detalhes reais do sistema selecionado no menu do /sistemas ver
        if (interaction.isStringSelectMenu() && interaction.customId === 'rpg_ver_detalhes') {
            const systemId = interaction.values[0];
            const sys = db.prepare('SELECT * FROM rpg_systems WHERE id = ? AND userId = ?').get(systemId, interaction.user.id);

            if (!sys) {
                return await interaction.reply({ content: '❌ Sistema não encontrado ou você não tem permissão para vê-lo.', ephemeral: true });
            }

            const nomeSistema = sys.nome || sys.nomeSistema || 'Sistema RPG';
            let configStr = '{}';
            try {
                const parsedConfig = JSON.parse(sys.config || '{}');
                configStr = JSON.stringify(parsedConfig, null, 2);
            } catch (e) {
                configStr = sys.config || '{}';
            }

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`📜 Detalhes do Sistema: ${nomeSistema}`)
                .setDescription(`**ID do Sistema:** ${sys.id}\n\n**Configuração:**\n\`\`\`json\n${configStr}\n\`\`\``);

            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'deletar_sistema_select') {
            await interaction.deferUpdate();

            const idsParaDeletar = interaction.values;
            const placeholders = idsParaDeletar.map(() => '?').join(',');
            const sistemasSelecionados = db.prepare(`SELECT * FROM rpg_systems WHERE id IN (${placeholders}) AND userId = ?`).all(...idsParaDeletar, interaction.user.id);
            
            const nomes = sistemasSelecionados.map(sys => sys.nome || sys.nomeSistema || 'Sistema').join(', ');

            pendingDeletions.set(interaction.user.id, idsParaDeletar);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('deletar_sim')
                    .setLabel('Sim')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('deletar_nao')
                    .setLabel('Não')
                    .setStyle(ButtonStyle.Danger)
            );

            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('⚠️ Confirmação de Deleção')
                .setDescription(`Tem certeza que deseja deletar **${nomes}**?`);

            await interaction.editReply({ embeds: [embed], components: [row] });
            return true;
        }

        if (interaction.isButton() && (interaction.customId === 'deletar_sim' || interaction.customId === 'deletar_nao')) {
            await interaction.deferUpdate();

            if (interaction.customId === 'deletar_nao') {
                pendingDeletions.delete(interaction.user.id);
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('❌ Operação Cancelada')
                    .setDescription('A exclusão dos sistemas foi cancelada.');
                await interaction.editReply({ embeds: [embed], components: [] });
                return true;
            }

            if (interaction.customId === 'deletar_sim') {
                const idsParaDeletar = pendingDeletions.get(interaction.user.id);

                if (!idsParaDeletar || idsParaDeletar.length === 0) {
                    return interaction.editReply({ content: '⚠️ Nenhum sistema pendente para deleção ou sessão expirada.', embeds: [], components: [] });
                }

                const deleteStmt = db.prepare('DELETE FROM rpg_systems WHERE id = ? AND userId = ?');
                const deletarMuitos = db.transaction((ids) => {
                    for (const id of ids) {
                        deleteStmt.run(id, interaction.user.id);
                    }
                });

                deletarMuitos(idsParaDeletar);
                pendingDeletions.delete(interaction.user.id);

                const embed = new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('✅ Sistemas Deletados com Sucesso!')
                    .setDescription(`Foram removidos **${idsParaDeletar.length}** sistema(s) do seu banco de dados.`);

                await interaction.editReply({ embeds: [embed], components: [] });
                return true;
            }
        }

        return false;
    }
};