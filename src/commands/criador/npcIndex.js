const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('npcs')
        .setDescription('Gerenciamento de NPCs criados')
        .addSubcommand(sub =>
            sub.setName('ver')
               .setDescription('Visualiza todos os NPCs criados')
        )
        .addSubcommand(sub =>
            sub.setName('deletar')
               .setDescription('Deleta uma ou mais fichas de NPCs')
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ Este comando só pode ser usado em servidores.', flags: [MessageFlags.Ephemeral] });
        }

        const subcommand = interaction.options.getSubcommand();

        // --- SUBCOMANDO: VER ---
        if (subcommand === 'ver') {
            let npcs = [];
            try {
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS lista_ficha_npcs (
                        id TEXT PRIMARY KEY,
                        userId TEXT,
                        guildId TEXT,
                        systemId TEXT,
                        name TEXT,
                        sheetData TEXT,
                        createdAt TEXT
                    )
                `).run();

                npcs = db.prepare('SELECT * FROM lista_ficha_npcs WHERE guildId = ?').all(interaction.guild.id);
            } catch (e) {
                console.error('Erro ao buscar NPCs:', e);
            }

            if (!npcs || npcs.length === 0) {
                return interaction.reply({
                    content: `📂 Você ainda não criou nenhum **NPC** neste servidor. Use \`/criador criar\` para criar um!`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle(`👥 Todos os NPCs Criados`)
                .setDescription(`Aqui estão todos os NPCs cadastrados no banco de dados:`)
                .setTimestamp();

            const options = npcs.map(npc => ({
                label: (npc.name || 'NPC Sem Nome').substring(0, 100),
                description: npc.createdAt ? `Criado em: ${new Date(npc.createdAt).toLocaleDateString('pt-BR')}` : 'Criado recentemente',
                value: String(npc.id)
            })).slice(0, 25);

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('npc_ver_detalhes')
                    .setPlaceholder('Selecione um NPC para ver a ficha completa...')
                    .addOptions(options)
            );

            return interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] });
        }

        // --- SUBCOMANDO: DELETAR ---
        if (subcommand === 'deletar') {
            let npcs = [];
            try {
                db.prepare(`
                    CREATE TABLE IF NOT EXISTS lista_ficha_npcs (
                        id TEXT PRIMARY KEY,
                        userId TEXT,
                        guildId TEXT,
                        systemId TEXT,
                        name TEXT,
                        sheetData TEXT,
                        createdAt TEXT
                    )
                `).run();

                npcs = db.prepare('SELECT * FROM lista_ficha_npcs WHERE guildId = ?').all(interaction.guild.id);
            } catch (e) {
                console.error('Erro ao buscar NPCs:', e);
            }

            if (!npcs || npcs.length === 0) {
                return interaction.reply({
                    content: `📂 Não há nenhum **NPC** cadastrado neste servidor para deletar.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const options = npcs.map((npc) => ({
                label: (npc.name || 'NPC Sem Nome').substring(0, 100),
                description: npc.createdAt ? `Criado em: ${new Date(npc.createdAt).toLocaleDateString('pt-BR')}` : 'Criado recentemente',
                value: String(npc.id)
            })).slice(0, 25);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_npcs_deletar')
                .setPlaceholder('Selecione uma ou mais fichas para deletar...')
                .setMinValues(1)
                .setMaxValues(options.length)
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('🗑️ Deletar Fichas de NPCs')
                .setDescription('Quais fichas de NPC deseja deletar? Selecione abaixo no menu (você pode marcar várias):');

            const replyMsg = await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral], fetchReply: true });

            const collector = replyMsg.createMessageComponentCollector({ time: 120000 });
            let selectedIds = [];

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: '❌ Você não pode interagir com este menu.', flags: [MessageFlags.Ephemeral] });
                }

                if (i.isStringSelectMenu() && i.customId === 'select_npcs_deletar') {
                    selectedIds = i.values;
                    const selectedNpcs = npcs.filter(npc => selectedIds.includes(npc.id));
                    const nomesStr = selectedNpcs.map(npc => `**${npc.name || 'Sem Nome'}**`).join(', ');

                    const confirmEmbed = new EmbedBuilder()
                        .setColor('#FEE75C')
                        .setTitle('⚠️ Confirmação de Exclusão')
                        .setDescription(`Tem certeza que deseja deletar os seguintes NPCs:\n${nomesStr}?`);

                    const confirmRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('confirm_npc_sim').setLabel('Sim').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('confirm_npc_nao').setLabel('Não').setStyle(ButtonStyle.Danger)
                    );

                    await i.update({
                        embeds: [confirmEmbed],
                        components: [confirmRow]
                    });
                } else if (i.isButton()) {
                    if (i.customId === 'confirm_npc_sim') {
                        if (selectedIds.length > 0) {
                            try {
                                const placeholders = selectedIds.map(() => '?').join(',');
                                db.prepare(`DELETE FROM lista_ficha_npcs WHERE id IN (${placeholders})`).run(...selectedIds);
                            } catch (err) {
                                console.error('Erro ao deletar NPCs:', err);
                            }
                        }

                        const successEmbed = new EmbedBuilder()
                            .setColor('#57F287')
                            .setTitle('✅ NPCs Deletados')
                            .setDescription(`As fichas selecionadas foram deletadas com sucesso do servidor!`);

                        await i.update({ embeds: [successEmbed], components: [] });
                        collector.stop();
                    } else if (i.customId === 'confirm_npc_nao') {
                        const cancelEmbed = new EmbedBuilder()
                            .setColor('#ED4245')
                            .setTitle('❌ Operação Cancelada')
                            .setDescription('Nenhuma ficha foi deletada.');

                        await i.update({ embeds: [cancelEmbed], components: [] });
                        collector.stop();
                    }
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    try { await interaction.editReply({ components: [] }).catch(() => {}); } catch (e) {}
                }
            });
        }
    },

    async handleInteractions(interaction) {
        if (interaction.isStringSelectMenu() && interaction.customId === 'npc_ver_detalhes') {
            const npcId = interaction.values[0];
            const npc = db.prepare('SELECT * FROM lista_ficha_npcs WHERE id = ?').get(npcId);

            if (!npc) {
                return interaction.update({ content: '❌ NPC não encontrado.', embeds: [], components: [] });
            }

            let sheetData = {};
            try { sheetData = JSON.parse(npc.sheetData); } catch (e) {}

            const jsonString = JSON.stringify(sheetData, null, 2);
            const truncated = jsonString.length > 3900 ? jsonString.substring(0, 3900) + '\n...' : jsonString;

            const detailEmbed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle(`👥 Ficha de NPC: ${npc.name || 'Sem Nome'}`)
                .setDescription(`\`\`\`json\n${truncated}\n\`\`\``)
                .setTimestamp();

            return interaction.update({ embeds: [detailEmbed], components: [] });
        }
        return false;
    }
};