const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');

const sessionEditarItem = new Map();

module.exports = {
    async iniciar(interaction, targetUserId, fichaId) {
        const invDb = new Database(path.resolve('inventarioplayers-database.sqlite'));
        invDb.prepare(`
            CREATE TABLE IF NOT EXISTS inventario_itens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fichaId TEXT,
                tipo TEXT,
                itemId TEXT,
                nome TEXT,
                quantia INTEGER,
                peso REAL,
                dadoDano TEXT,
                bonusDano TEXT,
                bonusCa TEXT,
                penalidadeDestreza TEXT,
                descricao TEXT,
                equipado INTEGER DEFAULT 0
            )
        `).run();

        const itens = invDb.prepare('SELECT * FROM inventario_itens WHERE fichaId = ?').all(fichaId);
        invDb.close();

        if (!itens || itens.length === 0) {
            return interaction.update({ content: '⚠️ Este personagem não possui nenhum item no inventário para editar.', components: [], embeds: [] });
        }

        const options = itens.slice(0, 25).map(i => ({
            label: String(i.nome).substring(0, 100),
            description: `Tipo: ${i.tipo} | Qnt: ${i.quantia || 1}`,
            value: String(i.id)
        }));

        sessionEditarItem.set(interaction.user.id, { fichaId, itensCache: itens });

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`editar_item_selecionar_${targetUserId}`)
                .setPlaceholder('Selecione o item que deseja editar...')
                .addOptions(options)
        );

        return interaction.update({ content: '✏️ Selecione abaixo o item que deseja **editar**:', components: [row], embeds: [] });
    },

    async handleInteractions(interaction) {
        const customId = interaction.customId;
        if (!customId) return false;

        if (customId.startsWith('editar_item_selecionar_')) {
            const session = sessionEditarItem.get(interaction.user.id);
            if (!session) return interaction.reply({ content: '⚠️ Sessão expirada.', flags: [MessageFlags.Ephemeral] });

            const itemDbId = interaction.values[0];
            const itemObj = session.itensCache.find(i => String(i.id) === String(itemDbId));

            if (!itemObj) {
                return interaction.reply({ content: '❌ Item não encontrado.', flags: [MessageFlags.Ephemeral] });
            }

            session.currentItemId = itemDbId;
            session.currentItem = itemObj;

            let options = [];
            if (itemObj.tipo === 'comum') {
                options = [
                    { label: 'Quantia', value: 'quantia', description: 'Alterar a quantidade do item no inventário', emoji: '🔢' }
                ];
            } else if (itemObj.tipo === 'arma') {
                options = [
                    { label: 'Nome', value: 'nome', description: 'Alterar o nome da arma', emoji: '✏️' },
                    { label: 'Dados de dano', value: 'dadoDano', description: `Atual: ${itemObj.dadoDano || 'Nenhum'}`, emoji: '🎲' },
                    { label: 'Bônus extra de dano', value: 'bonusDano', description: `Atual: ${itemObj.bonusDano || 'Nenhum'}`, emoji: '➕' },
                    { label: 'Descrição', value: 'descricao', description: 'Alterar a descrição', emoji: '📝' },
                    { label: 'Peso', value: 'peso', description: `Atual: ${itemObj.peso || 0}kg`, emoji: '⚖️' }
                ];
            } else if (itemObj.tipo === 'armadura') {
                options = [
                    { label: 'Nome', value: 'nome', description: 'Alterar o nome da armadura', emoji: '✏️' },
                    { label: 'Bônus em CA', value: 'bonusCa', description: `Atual: ${itemObj.bonusCa || 'Nenhum'}`, emoji: '🛡️' },
                    { label: 'Penalidade de destreza', value: 'penalidadeDestreza', description: `Atual: ${itemObj.penalidadeDestreza || 'Nenhum'}`, emoji: '⚠️' },
                    { label: 'Descrição', value: 'descricao', description: 'Alterar a descrição', emoji: '📝' },
                    { label: 'Peso', value: 'peso', description: `Atual: ${itemObj.peso || 0}kg`, emoji: '⚖️' }
                ];
            }

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('editar_item_propriedade')
                    .setPlaceholder('O que deseja editar neste item?')
                    .addOptions(options)
            );

            return interaction.update({ content: `✏️ Item selecionado: **${itemObj.nome}** (${itemObj.tipo}). O que deseja editar?`, components: [row] });
        }

        if (customId === 'editar_item_propriedade') {
            const session = sessionEditarItem.get(interaction.user.id);
            if (!session) return interaction.reply({ content: '⚠️ Sessão expirada.', flags: [MessageFlags.Ephemeral] });

            session.propriedade = interaction.values[0];
            session.waitingForNewValue = true;

            const propNomes = {
                quantia: 'nova quantia (ex: 2)',
                nome: 'novo nome',
                dadoDano: 'novo dado de dano (ex: 1d8)',
                bonusDano: 'novo bônus extra de dano (ex: +2)',
                bonusCa: 'novo bônus em CA (ex: +3)',
                penalidadeDestreza: 'nova penalidade de destreza',
                descricao: 'nova descrição',
                peso: 'novo peso (ex: 1.5)'
            };

            return interaction.update({
                content: `💬 Digite no chat o **${propNomes[session.propriedade] || session.propriedade}** para o item **${session.currentItem.nome}**:`,
                components: []
            });
        }

        return false;
    },

    async handleMessages(message) {
        const session = sessionEditarItem.get(message.author.id);
        if (!session || !session.waitingForNewValue) return false;

        const conteudo = message.content.trim();
        try {
            await message.delete();
        } catch (e) {}

        const invDb = new Database(path.resolve('inventarioplayers-database.sqlite'));
        const item = session.currentItem;

        if (session.propriedade === 'quantia') {
            const novaQtd = parseInt(conteudo);
            if (isNaN(novaQtd) || novaQtd < 0) {
                invDb.close();
                sessionEditarItem.delete(message.author.id);
                return true;
            }

            const pesoUnitario = item.quantia > 0 ? (item.peso / item.quantia) : item.peso;
            const novoPeso = pesoUnitario * novaQtd;

            invDb.prepare('UPDATE inventario_itens SET quantia = ?, peso = ? WHERE id = ?').run(novaQtd, novoPeso, item.id);
            invDb.close();

            sessionEditarItem.delete(message.author.id);
            message.channel.send(`✅ Quantidade do item **${item.nome}** alterada para **${novaQtd}** (Novo peso: ${novoPeso}kg).`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
            return true;
        } else if (session.propriedade === 'nome') {
            invDb.prepare('UPDATE inventario_itens SET nome = ? WHERE id = ?').run(conteudo, item.id);
            invDb.close();
            sessionEditarItem.delete(message.author.id);
            message.channel.send(`✅ Nome alterado para **${conteudo}** com sucesso!`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
            return true;
        } else if (session.propriedade === 'dadoDano') {
            invDb.prepare('UPDATE inventario_itens SET dadoDano = ? WHERE id = ?').run(conteudo, item.id);
            invDb.close();
            sessionEditarItem.delete(message.author.id);
            message.channel.send(`✅ Dado de dano alterado para **${conteudo}**!`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
            return true;
        } else if (session.propriedade === 'bonusDano') {
            invDb.prepare('UPDATE inventario_itens SET bonusDano = ? WHERE id = ?').run(conteudo, item.id);
            invDb.close();
            sessionEditarItem.delete(message.author.id);
            message.channel.send(`✅ Bônus extra de dano alterado para **${conteudo}**!`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
            return true;
        } else if (session.propriedade === 'bonusCa') {
            invDb.prepare('UPDATE inventario_itens SET bonusCa = ? WHERE id = ?').run(conteudo, item.id);
            invDb.close();
            sessionEditarItem.delete(message.author.id);
            message.channel.send(`✅ Bônus em CA alterado para **${conteudo}**!`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
            return true;
        } else if (session.propriedade === 'penalidadeDestreza') {
            invDb.prepare('UPDATE inventario_itens SET penalidadeDestreza = ? WHERE id = ?').run(conteudo, item.id);
            invDb.close();
            sessionEditarItem.delete(message.author.id);
            message.channel.send(`✅ Penalidade de destreza alterada para **${conteudo}**!`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
            return true;
        } else if (session.propriedade === 'descricao') {
            invDb.prepare('UPDATE inventario_itens SET descricao = ? WHERE id = ?').run(conteudo, item.id);
            invDb.close();
            sessionEditarItem.delete(message.author.id);
            message.channel.send(`✅ Descrição atualizada com sucesso!`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
            return true;
        } else if (session.propriedade === 'peso') {
            const novoPeso = parseFloat(conteudo);
            if (isNaN(novoPeso) || novoPeso < 0) {
                invDb.close();
                sessionEditarItem.delete(message.author.id);
                return true;
            }
            invDb.prepare('UPDATE inventario_itens SET peso = ? WHERE id = ?').run(novoPeso, item.id);
            invDb.close();
            sessionEditarItem.delete(message.author.id);
            message.channel.send(`✅ Peso do item alterado para **${novoPeso}kg** com sucesso!`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
            return true;
        }

        invDb.close();
        return false;
    }
};