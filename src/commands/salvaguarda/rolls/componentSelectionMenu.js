const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { obterContextoAtivo } = require('./checkActiveContext');
const { setConfigTemp } = require('./salvaguardaStore');
const { avancarProximoPasso } = require('./salvaguardaFlow');

async function iniciarSelecaoComponentes(interaction, subtipoChave) {
    const contexto = obterContextoAtivo(interaction.user.id, interaction.guild.id);
    if (contexto.erro) {
        const embedErro = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('❌ Erro de Contexto')
            .setDescription(contexto.erro);
        return interaction.update({ embeds: [embedErro], components: [] });
    }

    const sistemaConfig = contexto.sistemaConfig || {};
    
    const temAtributosConfig = sistemaConfig.temAtributos !== false;
    const temPericiasConfig = sistemaConfig.temPericias !== false;
    const temCaConfig = sistemaConfig.temCa !== false;

    const options = [
        { label: 'Rolagem de dados', value: 'rolagem_dados', description: 'Ex: 1d6, 1d10, etc.' }
    ];

    if (temAtributosConfig) options.push({ label: 'Atributos', value: 'atributos', description: 'Ex: Força, Destreza, etc.' });
    if (temPericiasConfig) options.push({ label: 'Pericias', value: 'pericias', description: 'Ex: Atletismo, Furtividade, etc.' });
    options.push({ label: 'Valor fixo', value: 'valor_fixo', description: 'Ex: 14, 5, etc.' });
    if (temCaConfig) options.push({ label: 'Sistema de CA', value: 'sistema_ca', description: 'Pega automaticamente o valor da CA' });

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚙️ Componentes da Salvaguarda')
        .setDescription(
            `Subtipo selecionado: \`${subtipoChave}\`\n\n` +
            '**Como deseja que seja a rolagem para se salvar de coisas que envolvem esse subtipo?**\n' +
            '*(Você pode selecionar mais de uma opção no menu abaixo)*'
        );

    const customIdMenu = `salv_comp_select_${subtipoChave}`;
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(customIdMenu)
        .setPlaceholder('Selecione os componentes (múltiplos)...')
        .setMinValues(1)
        .setMaxValues(Math.min(options.length, 5))
        .addOptions(options.slice(0, 25));

    const row = new ActionRowBuilder().addComponents(selectMenu);

    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
        await interaction.update({ embeds: [embed], components: [row] });
    }

    try {
        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId === customIdMenu,
            time: 300000
        });

        collector.on('collect', async i => {
            // RESPONDE IMEDIATAMENTE PARA EVITAR O ERRO 10062
            if (!i.deferred && !i.replied) {
                try { await i.deferUpdate(); } catch (err) {}
            }

            setConfigTemp(i.user.id, subtipoChave, { 
                componentes: i.values,
                atributosColetados: false,
                periciasColetadas: false 
            });

            collector.stop();

            return avancarProximoPasso(i, subtipoChave);
        });
    } catch (err) {
        console.error("Erro no coletor de componentes:", err);
    }
}

module.exports = { iniciarSelecaoComponentes };