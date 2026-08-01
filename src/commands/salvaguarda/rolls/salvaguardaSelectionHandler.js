const { EmbedBuilder } = require('discord.js');
const { obterContextoAtivo } = require('./checkActiveContext');
const { perguntarModoDado } = require('./diceQuantityOrMaxValueHandler');

async function tratarSelecaoSalvaguarda(interaction) {
    if (!interaction.isStringSelectMenu()) return false;

    const customId = interaction.customId;

    // Trata Atributos Múltiplos
    if (customId.startsWith('salv_attr_select_')) {
        await interaction.deferUpdate();

        const subtipoChave = customId.replace('salv_attr_select_', '');
        const selecionados = interaction.values; // Array com os atributos escolhidos

        const contexto = obterContextoAtivo(interaction.user.id, interaction.guild.id);
        const valoresFicha = contexto.fichaAtributos || contexto.atributosFicha || contexto.data?.atributos || {};

        let somaTotal = 0;
        let partes = [];

        for (const attr of selecionados) {
            const valor = Number(valoresFicha[attr]) || 0;
            somaTotal += valor;
            partes.push(`${valor}`); // Mostra o valor numérico de cada um
        }

        const calculoFormatado = partes.length > 0 ? `${partes.join(' + ')} = ${somaTotal}` : `0 = 0`;

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('📊 Atributos Selecionados')
            .setDescription(`Subtipo: \`${subtipoChave}\`\n\nSoma calculada:\n\`${calculoFormatado}\``);

        // Avança para a próxima etapa (ex: Modo do Dado)
        await interaction.editReply({ embeds: [embed], components: [] });
        return perguntarModoDado(interaction, subtipoChave);
    }

    // Trata Perícias Múltiplas
    if (customId.startsWith('salv_skill_select_')) {
        await interaction.deferUpdate();

        const subtipoChave = customId.replace('salv_skill_select_', '');
        const selecionados = interaction.values; // Array com as perícias escolhidas

        const contexto = obterContextoAtivo(interaction.user.id, interaction.guild.id);
        const valoresFicha = contexto.fichaPericias || contexto.periciasFicha || contexto.data?.pericias || {};

        let somaTotal = 0;
        let partes = [];

        for (const skill of selecionados) {
            const valor = Number(valoresFicha[skill]) || 0;
            somaTotal += valor;
            partes.push(`${valor}`);
        }

        const calculoFormatado = partes.length > 0 ? `${partes.join(' + ')} = ${somaTotal}` : `0 = 0`;

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🎯 Perícias Selecionadas')
            .setDescription(`Subtipo: \`${subtipoChave}\`\n\nSoma calculada:\n\`${calculoFormatado}\``);

        await interaction.editReply({ embeds: [embed], components: [] });
        return perguntarModoDado(interaction, subtipoChave);
    }

    return false;
}

module.exports = { tratarSelecaoSalvaguarda };