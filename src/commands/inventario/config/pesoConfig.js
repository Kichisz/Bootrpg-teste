const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const dbManager = require('../database/dbManager');
const punicaoConfig = require('./punicaoConfig');

async function iniciarConfigPeso(interaction, session) {
    const sistemaAtivo = dbManager.getSistemaAtivo();
    if (!sistemaAtivo) {
        const payload = { content: '❌ Nenhum sistema de RPG ativo neste servidor!', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(payload);
        }
        return await interaction.reply(payload);
    }

    session.sistemaNome = sistemaAtivo.nomeSistema;
    const temAtributos = sistemaAtivo.temAtributos && sistemaAtivo.atributosLista && sistemaAtivo.atributosLista.length > 0;

    const options = [];
    if (temAtributos) {
        options.push({ label: 'Atributo x valor fixo', description: 'Ex: Força x 10', value: 'atrib_vezes_fixo' });
    }
    options.push({ label: 'Valor fixo', description: 'Ex: Todos podem carregar até 200kg', value: 'valor_fixo' });

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚖️ Configuração de Peso Máximo')
        .setDescription('Como devemos calcular qual o peso máximo que um jogador poderá suportar em itens?');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('inv_config_peso_calculo')
            .setPlaceholder('Selecione o modo de cálculo...')
            .addOptions(options)
    );

    // Verifica se a interação suporta update (botão/menu) ou se é chat input command (/)
    if (typeof interaction.update === 'function') {
        await interaction.update({ embeds: [embed], components: [row] });
    } else if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
        await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    }
}

async function tratarInteracaoPeso(interaction, session) {
    if (!interaction.isStringSelectMenu()) return false;
    const customId = interaction.customId;
    const sistemaNome = session.sistemaNome || dbManager.getSistemaAtivo()?.nomeSistema;

    if (customId === 'inv_config_peso_calculo') {
        const escolha = interaction.values[0];
        let pesoConfig = dbManager.carregarPesoSistema(sistemaNome) || {};
        pesoConfig.tipoCalculo = escolha;
        dbManager.salvarPesoSistema(sistemaNome, pesoConfig);

        if (escolha === 'atrib_vezes_fixo') {
            const sistemaAtivo = dbManager.getSistemaAtivo();
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('💪 Atributo para Peso')
                .setDescription('Qual atributo vai usar para calcular o peso máximo?');

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('inv_config_peso_atributo')
                    .setPlaceholder('Selecione o atributo...')
                    .addOptions(sistemaAtivo.atributosLista.map(attr => ({ label: attr, value: attr })))
            );
            await interaction.update({ embeds: [embed], components: [row] });
            return true;
        } else {
            session.waitingForPesoFixo = true;
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📦 Valor Fixo de Peso')
                .setDescription('Qual valor fixo que alguém pode carregar no máximo? (Ex: `200` para 200kg). Envie apenas o número no chat.');
            await interaction.update({ embeds: [embed], components: [] });
            return true;
        }
    }

    if (customId === 'inv_config_peso_atributo') {
        const atributoEscolhido = interaction.values[0];
        let pesoConfig = dbManager.carregarPesoSistema(sistemaNome) || {};
        pesoConfig.atributo = atributoEscolhido;
        dbManager.salvarPesoSistema(sistemaNome, pesoConfig);

        session.waitingForPesoMultiplicador = true;
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('✖️ Multiplicador do Atributo')
            .setDescription(`E o valor do atributo **${atributoEscolhido}** será multiplicado por quanto para calcular o peso máximo?\n\n💡 *Nota: Se o seu sistema usa modificadores (ex: D&D força 12 = mod +1), o bot usará o modificador ou base conforme configurado no sistema.* Envie o valor multiplicador no chat:`);
        await interaction.update({ embeds: [embed], components: [] });
        return true;
    }

    if (customId === 'inv_config_punicao_escolha') {
        const punicao = interaction.values[0];
        let pesoConfig = dbManager.carregarPesoSistema(sistemaNome) || {};
        pesoConfig.punicao = punicao;
        dbManager.salvarPesoSistema(sistemaNome, pesoConfig);

        if (punicao === 'penalidade') {
            session.waitingForPenalidadeValor = true;
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('⚠️ Valor da Penalidade')
                .setDescription('A cada quantos % (ou kg) do valor máximo de KG devemos aplicar uma penalidade de -1 em todos os atributos? (Ex: `10` para cada 10%). Envie no chat:');
            await interaction.update({ embeds: [embed], components: [] });
            return true;
        } else {
            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('✅ Configuração de Peso Concluída')
                .setDescription(`O sistema de peso para **${sistemaNome}** foi configurado com bloqueio de excesso!`);
            await interaction.update({ embeds: [embed], components: [] });
            return true;
        }
    }

    return false;
}

async function processarPesoTexto(message, session) {
    const texto = message.content.trim();
    const sistemaNome = session.sistemaNome || dbManager.getSistemaAtivo()?.nomeSistema;
    let pesoConfig = dbManager.carregarPesoSistema(sistemaNome) || {};

    if (session.waitingForPesoFixo) {
        pesoConfig.valorFixo = texto;
        session.waitingForPesoFixo = false;
        try { await message.delete(); } catch (e) {}
        dbManager.salvarPesoSistema(sistemaNome, pesoConfig);
        await punicaoConfig.perguntarPunicaoPeso(message, session);
        return true;
    }

    if (session.waitingForPesoMultiplicador) {
        pesoConfig.multiplicador = texto;
        session.waitingForPesoMultiplicador = false;
        try { await message.delete(); } catch (e) {}
        dbManager.salvarPesoSistema(sistemaNome, pesoConfig);
        await punicaoConfig.perguntarPunicaoPeso(message, session);
        return true;
    }

    return false;
}

module.exports = { iniciarConfigPeso, tratarInteracaoPeso, processarPesoTexto };