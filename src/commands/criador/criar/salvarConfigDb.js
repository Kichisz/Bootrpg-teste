const fs = require('fs');
const path = require('path');
const { MessageFlags } = require('discord.js');
const sessionCriador = require('./sessionCriador');

async function processarValor(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    const num = parseInt(texto, 10);
    if (isNaN(num) && session.step !== 'RECURSOS') {
        if (session.interactionRef) {
            return session.interactionRef.followUp({ content: '❌ Por favor, digite um número válido.', flags: [MessageFlags.Ephemeral] });
        }
        return;
    }

    switch (session.step) {
        case 'ATRIB_MIN': session.data.atribMin = num; break;
        case 'ATRIB_MAX': session.data.atribMax = num; break;
        case 'PERICIA_MIN': session.data.periciaMin = num; break;
        case 'PERICIA_MAX': session.data.periciaMax = num; break;
        case 'PV_MIN': session.data.pvMin = num; break;
        case 'PV_MAX': session.data.pvMax = num; break;
        case 'PM_MIN': session.data.pmMin = num; break;
        case 'PM_MAX': session.data.pmMax = num; break;
        case 'CA_VALOR': session.data.caValor = num; break;
    }

    await sessionCriador.avancarProximoPasso(message, session);
}

async function finalizar(message, session) {
    const configFinal = {};

    if (session.hasAtributos) {
        if (session.data.atribMin !== undefined) configFinal['Atributo mínimo'] = session.data.atribMin;
        if (session.data.atribMax !== undefined) configFinal['Atributo máximo'] = session.data.atribMax;
    }

    if (session.hasPericias) {
        if (session.data.periciaMin !== undefined) configFinal['Perícia mínima'] = session.data.periciaMin;
        if (session.data.periciaMax !== undefined) configFinal['Perícia máxima'] = session.data.periciaMax;
    }

    if (session.hasPv) {
        const nomePv = session.pvNome || 'PV';
        if (session.data.pvMin !== undefined) configFinal[`${nomePv} mínimo`] = session.data.pvMin;
        if (session.data.pvMax !== undefined) configFinal[`${nomePv} máximo`] = session.data.pvMax;
    }

    if (session.hasPm) {
        const nomePm = session.pmNome || 'PM';
        if (session.data.pmMin !== undefined) configFinal[`${nomePm} mínimo`] = session.data.pmMin;
        if (session.data.pmMax !== undefined) configFinal[`${nomePm} máximo`] = session.data.pmMax;
    }

    if (session.hasCa) {
        if (session.data.caValor !== undefined) configFinal['Classe de Armadura'] = session.data.caValor;
    }

    try {
        const guildId = session.interactionRef ? session.interactionRef.guildId : message.guildId;
        
        // Estrutura do objeto completo que será salvo no arquivo JSON solto
        const dadosParaArquivo = {
            id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            guildId: guildId,
            systemId: session.systemId,
            userId: session.userId,
            configName: session.configName,
            criadoEm: new Date().toISOString(),
            configData: configFinal
        };

        // Define a pasta onde os arquivos JSON ficarão salvos na raiz do projeto
        const dirPath = path.join(process.cwd(), 'configs_npcs');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Nome do arquivo único baseado no ID gerado
        const filePath = path.join(dirPath, `${dadosParaArquivo.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(dadosParaArquivo, null, 2), 'utf8');

        if (session.interactionRef) {
            await session.interactionRef.editReply({
                content: `✅ Configuração de NPC **"${session.configName}"** salva com sucesso em arquivo JSON solto!\n\`\`\`json\n${JSON.stringify(configFinal, null, 2)}\n\`\`\``,
                embeds: [],
                flags: [MessageFlags.Ephemeral]
            });
        }
    } catch (err) {
        console.error('Erro ao salvar arquivo JSON de configuração:', err);
        if (session.interactionRef) {
            await session.interactionRef.followUp({ content: '❌ Ocorreu um erro ao salvar o arquivo de configuração.', flags: [MessageFlags.Ephemeral] });
        }
    }

    sessionCriador.clearSession(session.userId);
}

module.exports = {
    processarValor,
    finalizar
};