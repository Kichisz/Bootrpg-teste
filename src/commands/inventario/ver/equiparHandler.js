const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');
const dbInventario = require('../database/dbInventario');

const equiparSessions = new Map();

module.exports = {
    async executarEquipar(interaction, session) {
        const item = session.itemSelecionado;
        const invDb = dbInventario;
        const itens = invDb.prepare('SELECT * FROM inventario_itens WHERE fichaId = ?').all(session.fichaId);

        if (Number(item.equipado) === 1) {
            // Desequipar
            invDb.prepare('UPDATE inventario_itens SET equipado = 0 WHERE id = ?').run(item.id);
            return interaction.update({ content: `✅ Você desequipou **${item.nome}**.`, components: [] });
        }

        // Verificar se já tem item equipado no mesmo tipo (arma ou armadura)
        const itemEquipadoAtual = itens.find(i => i.tipo === item.tipo && Number(i.equipado) === 1);

        if (itemEquipadoAtual) {
            equiparSessions.set(interaction.user.id, { fichaId: session.fichaId, novoItemId: item.id, antigoItemId: itemEquipadoAtual.id, nomeAntigo: itemEquipadoAtual.nome, nomeNovo: item.nome });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('equipar_sim').setLabel('Sim').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('equipar_nao').setLabel('Não').setStyle(ButtonStyle.Danger)
            );

            return interaction.update({ content: `⚠️ Você está prestes a trocar **${itemEquipadoAtual.nome}** por **${item.nome}**, tem certeza que deseja fazer isso?`, components: [row] });
        }

        // Se não tem nada equipado, equipar diretamente
        invDb.prepare(`UPDATE inventario_itens SET equipado = 1 WHERE id = ?`).run(item.id);

        return interaction.update({ content: `✅ Você equipou **${item.nome}** com sucesso!`, components: [] });
    },

    async handleInteractions(interaction) {
        if (!interaction.isButton()) return false;
        const customId = interaction.customId;

        if (customId === 'equipar_sim' || customId === 'equipar_nao') {
            const session = equiparSessions.get(interaction.user.id);
            if (!session) return interaction.reply({ content: '⚠️ Sessão expirada.', flags: [MessageFlags.Ephemeral] });

            if (customId === 'equipar_nao') {
                equiparSessions.delete(interaction.user.id);
                return interaction.update({ content: '❌ Troca de equipamento cancelada.', components: [] });
            }

            const invDb = dbInventario;
            invDb.prepare('UPDATE inventario_itens SET equipado = 0 WHERE id = ?').run(session.antigoItemId);
            invDb.prepare('UPDATE inventario_itens SET equipado = 1 WHERE id = ?').run(session.novoItemId);

            equiparSessions.delete(interaction.user.id);
            return interaction.update({ content: `✅ Equipamento trocado com sucesso! **${session.nomeAntigo}** foi enviado para o inventário e **${session.nomeNovo}** foi equipado.`, components: [] });
        }
        return false;
    }
};