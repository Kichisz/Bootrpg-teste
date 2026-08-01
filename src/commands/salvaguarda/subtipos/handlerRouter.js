const { getDb } = require('./database/dbConnection');
const { enviarMenuPrincipal } = require('./menu/sendMainMenu');
const { executarFluxoChatSubtipos } = require('./criar/fluxoChatSubtipos');
const { executarFluxoChatEdicao } = require('./editar/fluxoChatEdicao');
const { listarParaEditar } = require('./editar/listarSubtiposEditar');
const { perguntarCampoParaEditar } = require('./editar/escolherCampoEditar');
const { listarParaRemover } = require('./remover/listarSubtiposRemover');
const { confirmarRemocao } = require('./remover/executarRemocao');
const { listarSistemasParaClonar } = require('./clonar/listarSistemasOrigem');
const { confirmarAvisoClonagem } = require('./clonar/confirmarClonagem');
const { executarCopiaClonagem } = require('./clonar/executarClonagem');

async function handleSalvaguardaInteraction(interaction) {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return false;
    const id = interaction.customId;

    if (id.startsWith('salv_sub_inicial_')) {
        const sistema = id.replace('salv_sub_inicial_', '');
        const escolha = interaction.values[0];

        if (escolha === 'criar_nova') {
            return executarFluxoChatSubtipos(interaction, sistema);
        } else if (escolha === 'editar_existente') {
            const db = getDb();
            const listas = db.prepare('SELECT DISTINCT nomeLista FROM subtipos_salvaguarda WHERE sistema = ? AND userId = ?').all(sistema, interaction.user.id);
            db.close();

            const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setTitle('📚 Selecione a Lista para Editar')
                .setDescription('Escolha abaixo qual lista você deseja gerenciar:')
                .setColor(0x5865F2);

            const select = new StringSelectMenuBuilder()
                .setCustomId(`salv_escolher_lista_edit_${sistema}`)
                .setPlaceholder('Escolha a lista...');

            listas.forEach(l => { select.addOptions({ label: l.nomeLista, value: l.nomeLista }); });

            return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
        } 
        else if (escolha === 'deletar_lista_inteira') {
            const db = getDb();
            const listas = db.prepare('SELECT DISTINCT nomeLista FROM subtipos_salvaguarda WHERE sistema = ? AND userId = ?').all(sistema, interaction.user.id);
            db.close();

            const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setTitle('🗑️ Deletar Lista Inteira')
                .setDescription('⚠️ **Atenção:** Selecione abaixo qual lista você deseja **excluir permanentemente**:')
                .setColor(0xED4245);

            const select = new StringSelectMenuBuilder()
                .setCustomId(`salv_escolher_lista_deletar_${sistema}`)
                .setPlaceholder('Escolha a lista para excluir...');

            listas.forEach(l => { select.addOptions({ label: l.nomeLista, value: l.nomeLista }); });

            return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
        }
        // 🌟 NOVO: Fluxo para exibir as listas disponíveis para ativação pública
        else if (escolha === 'ativar_lista') {
            const db = getDb();
            const listas = db.prepare('SELECT DISTINCT nomeLista FROM subtipos_salvaguarda WHERE sistema = ?').all(sistema);
            db.close();

            const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setTitle('⭐ Ativar Lista de Subtipos')
                .setDescription('Selecione abaixo qual lista será a **oficial e ativa** deste sistema para uso público nas salvaguarda:')
                .setColor(0x5865F2);

            const select = new StringSelectMenuBuilder()
                .setCustomId(`salv_ativar_lista_select_${sistema}`)
                .setPlaceholder('Escolha a lista para ativar...');

            listas.forEach(l => { select.addOptions({ label: l.nomeLista, value: l.nomeLista }); });

            return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
        }
    }

    // 🌟 NOVO: Salva a lista escolhida como ativa no banco de dados
    if (id.startsWith('salv_ativar_lista_select_')) {
        const sistema = id.replace('salv_ativar_lista_select_', '');
        const nomeLista = interaction.values[0];

        const db = getDb();
        db.prepare(`
            INSERT INTO lista_ativa_salvaguarda (sistema, nomeLista, userId)
            VALUES (?, ?, ?)
            ON CONFLICT(sistema) DO UPDATE SET nomeLista = excluded.nomeLista, userId = excluded.userId
        `).run(sistema, nomeLista, interaction.user.id);
        db.close();

        const { EmbedBuilder } = require('discord.js');
        const embedSucesso = new EmbedBuilder()
            .setTitle('✅ Lista Ativada com Sucesso!')
            .setDescription(`A lista **"${nomeLista}"** agora é a lista oficial e pública deste sistema. Todas as salvaguardas configuradas a partir de agora usarão os subtipos dela!`)
            .setColor(0x57F287);

        return interaction.update({ embeds: [embedSucesso], components: [] });
    }

    if (id.startsWith('salv_escolher_lista_deletar_')) {
        const sistema = id.replace('salv_escolher_lista_deletar_', '');
        const nomeLista = interaction.values[0];

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Confirmação de Exclusão')
            .setDescription(`Tem certeza absoluta que deseja deletar **toda** a lista **"${nomeLista}"** do sistema **${sistema}**?\n\nEsta ação é irreversível!`)
            .setColor(0xED4245);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`salv_conf_del_lista_sim_${sistema}__${nomeLista}`)
                .setLabel('Sim, Deletar Tudo')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`salv_conf_del_lista_nao_${sistema}`)
                .setLabel('Cancelar')
                .setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({ embeds: [embed], components: [row] });
    }

    if (id.startsWith('salv_conf_del_lista_sim_')) {
        const resto = id.replace('salv_conf_del_lista_sim_', '');
        const [sistema, nomeLista] = resto.split('__');

        const db = getDb();
        db.prepare('DELETE FROM subtipos_salvaguarda WHERE sistema = ? AND nomeLista = ?').run(sistema, nomeLista);
        // Se a lista apagada era a ativa, removemos ela da tabela de ativas também
        db.prepare('DELETE FROM lista_ativa_salvaguarda WHERE sistema = ? AND nomeLista = ?').run(sistema, nomeLista);
        db.close();

        const { EmbedBuilder } = require('discord.js');
        const embedSucesso = new EmbedBuilder()
            .setTitle('✅ Lista Excluída com Sucesso')
            .setDescription(`A lista **"${nomeLista}"** foi completamente removida do sistema **${sistema}**.`)
            .setColor(0x57F287);

        return interaction.update({ embeds: [embedSucesso], components: [] });
    }

    if (id.startsWith('salv_conf_del_lista_nao_')) {
        const sistema = id.replace('salv_conf_del_lista_nao_', '');
        const { enviarMenuInicial } = require('./menu/enviarMenuInicial'); // Ajuste o caminho se necessário
        
        const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
        const db = getDb();
        const listas = db.prepare('SELECT DISTINCT nomeLista FROM subtipos_salvaguarda WHERE sistema = ? AND userId = ?').all(sistema, interaction.user.id);
        db.close();

        const embed = new EmbedBuilder()
            .setTitle(`🛡️ Subtipos de Salvaguarda [Sistema: ${sistema}]`)
            .setDescription('Exclusão cancelada. Escolha o que deseja fazer:')
            .setColor(0x5865F2);

        const selectOptions = [{ label: 'Criar uma nova lista de subtipos', value: 'criar_nova', description: 'Cria uma lista totalmente nova do zero' }];
        if (listas.length > 0) {
            selectOptions.push(
                { label: 'Editar lista existente', value: 'editar_existente', description: `Edita uma das suas ${listas.length} listas` },
                { label: 'Deletar lista existente', value: 'deletar_lista_inteira', description: 'Exclui permanentemente uma lista' },
                { label: '⭐ Ativar lista para o sistema', value: 'ativar_lista', description: 'Define qual lista será usada publicamente' }
            );
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId(`salv_sub_inicial_${sistema}`)
            .setPlaceholder('Selecione uma opção...')
            .addOptions(selectOptions);

        return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
    }

    if (id.startsWith('salv_escolher_lista_edit_')) {
        const sistema = id.replace('salv_escolher_lista_edit_', '');
        const nomeLista = interaction.values[0];
        return enviarMenuPrincipal(interaction, nomeLista, sistema);
    }

    if (id.startsWith('salv_main_action_')) {
        const resto = id.replace('salv_main_action_', '');
        const lastUnderscore = resto.lastIndexOf('_');
        const sistemaStr = resto.substring(lastUnderscore + 1);
        const nomeListaStr = resto.substring(0, lastUnderscore);
        const acao = interaction.values[0];

        if (acao === 'adicionar') return executarFluxoChatSubtipos(interaction, sistemaStr, nomeListaStr);
        if (acao === 'editar') return listarParaEditar(interaction, nomeListaStr, sistemaStr);
        if (acao === 'remover') return listarParaRemover(interaction, nomeListaStr, sistemaStr);
        if (acao === 'clonar') return listarSistemasParaClonar(interaction, sistemaStr);
    }

    if (id.startsWith('salv_edit_select_item_')) {
        const resto = id.replace('salv_edit_select_item_', '');
        const lastUnderscore = resto.lastIndexOf('_');
        const sistema = resto.substring(lastUnderscore + 1);
        const nomeLista = resto.substring(0, lastUnderscore);
        const subId = interaction.values[0];
        return perguntarCampoParaEditar(interaction, subId, nomeLista, sistema);
    }

    if (id.startsWith('salv_edit_campo_')) {
        const resto = id.replace('salv_edit_campo_', '');
        const p1 = resto.indexOf('_');
        const subId = resto.substring(0, p1);
        const resto2 = resto.substring(p1 + 1);
        const lastUnderscore = resto2.lastIndexOf('_');
        const sistema = resto2.substring(lastUnderscore + 1);
        const nomeLista = resto2.substring(0, lastUnderscore);
        const campo = interaction.values[0];
        return executarFluxoChatEdicao(interaction, subId, campo, nomeLista, sistema);
    }

    if (id.startsWith('salv_remove_select_')) {
        const resto = id.replace('salv_remove_select_', '');
        const lastUnderscore = resto.lastIndexOf('_');
        const sistema = resto.substring(lastUnderscore + 1);
        const nomeLista = resto.substring(0, lastUnderscore);
        return confirmarRemocao(interaction, interaction.values, nomeLista, sistema);
    }

    if (id.startsWith('salv_del_sim_')) {
        const resto = id.replace('salv_del_sim_', '');
        const lastUnderscore = resto.lastIndexOf('_');
        const sistema = resto.substring(lastUnderscore + 1);
        const resto2 = resto.substring(0, lastUnderscore);
        const secondLastUnderscore = resto2.lastIndexOf('_');
        const nomeLista = resto2.substring(secondLastUnderscore + 1);
        const ids = resto2.substring(0, secondLastUnderscore).split(',');

        const db = getDb();
        db.prepare(`DELETE FROM subtipos_salvaguarda WHERE id IN (${ids.map(() => '?').join(',')})`).run(ids);
        db.close();

        return enviarMenuPrincipal(interaction, nomeLista, sistema);
    }

    if (id.startsWith('salv_del_nao_')) {
        const resto = id.replace('salv_del_nao_', '');
        const lastUnderscore = resto.lastIndexOf('_');
        return enviarMenuPrincipal(interaction, resto.substring(0, lastUnderscore), resto.substring(lastUnderscore + 1));
    }

    if (id.startsWith('salv_clone_select_')) {
        const sistemaAtual = id.replace('salv_clone_select_', '');
        const [origem, lista] = interaction.values[0].split('__');
        return confirmarAvisoClonagem(interaction, origem, lista, sistemaAtual);
    }

    if (id.startsWith('salv_clone_sim_')) {
        const resto = id.replace('salv_clone_sim_', '');
        const partes = resto.split('__');
        executarCopiaClonagem(interaction.user.id, partes[0], partes[1], partes[2]);

        return interaction.update({
            content: `✅ Lista **"${partes[1]}"** clonada com sucesso para o sistema **${partes[2]}**!`,
            embeds: [],
            components: []
        });
    }

    if (id.startsWith('salv_clone_nao_')) {
        return enviarMenuPrincipal(interaction, 'Geral', id.replace('salv_clone_nao_', ''));
    }

    return false;
}

module.exports = { handleSalvaguardaInteraction };