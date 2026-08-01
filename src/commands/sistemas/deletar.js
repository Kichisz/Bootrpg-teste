const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../../database');

const pendingDeletions = new Map();

module.exports = {
    async execute(interaction) {
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
    },

    async handleSelect(interaction) {
        if (!interaction.isStringSelectMenu() || interaction.customId !== 'deletar_sistema_select') return false;

        // Responde INSTANTANEAMENTE ao Discord para evitar o timeout de 3 segundos
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
    },

    async handleButton(interaction) {
        if (!interaction.isButton() || (interaction.customId !== 'deletar_sim' && interaction.customId !== 'deletar_nao')) return false;

        // Responde INSTANTANEAMENTE ao Discord
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
};