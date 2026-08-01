const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getDb } = require('../database/dbConnection');

async function enviarMenuInicial(interaction, sistema) {
    const db = getDb();
    const listas = db.prepare('SELECT DISTINCT nomeLista FROM subtipos_salvaguarda WHERE sistema = ? AND userId = ?').all(sistema, interaction.user.id);
    
    // Pega qual lista está ativa atualmente para exibir no título/descrição se houver
    const ativa = db.prepare('SELECT nomeLista FROM lista_ativa_salvaguarda WHERE sistema = ?').get(sistema);
    db.close();

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ Subtipos de Salvaguarda [Sistema: ${sistema}]`)
        .setDescription(
            `Lista Ativa Atual: **${ativa ? ativa.nomeLista : 'Nenhuma definida'}**\n\n` +
            'O que você deseja fazer?'
        )
        .setColor(0x5865F2);

    const selectOptions = [
        {
            label: 'Criar uma nova lista de subtipos',
            value: 'criar_nova',
            description: 'Cria uma lista totalmente nova do zero'
        }
    ];

    if (listas.length > 0) {
        selectOptions.push(
            {
                label: 'Editar lista existente',
                value: 'editar_existente',
                description: `Edita uma das suas ${listas.length} listas existentes`
            },
            {
                label: 'Deletar lista existente',
                value: 'deletar_lista_inteira',
                description: 'Exclui permanentemente uma lista completa'
            },
            {
                label: '⭐ Ativar lista para o sistema',
                value: 'ativar_lista',
                description: 'Define qual lista será usada publicamente nas magias'
            }
        );
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId(`salv_sub_inicial_${sistema}`)
        .setPlaceholder('Selecione uma opção...')
        .addOptions(selectOptions);

    const row = new ActionRowBuilder().addComponents(select);

    if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ embeds: [embed], components: [row] });
    } else {
        return interaction.update({ embeds: [embed], components: [row] });
    }
}

module.exports = { enviarMenuInicial };