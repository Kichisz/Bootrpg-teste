const { getConfigTemp } = require('./salvaguardaStore');
const { perguntarModoDado } = require('./diceQuantityOrMaxValueHandler');

async function avancarProximoPasso(interaction, subtipoChave) {
    const temp = getConfigTemp(interaction.user.id, subtipoChave);
    const componentes = temp.componentes || [];

    // Se escolheu 'atributos' e ainda não coletou, chama o arquivo de atributos dinamicamente
    if (componentes.includes('atributos') && !temp.atributosColetados) {
        const { solicitarAtributo } = require('./attributeInputHandler');
        return solicitarAtributo(interaction, subtipoChave);
    }

    // Se escolheu 'pericias' e ainda não coletou, chama o arquivo de perícias dinamicamente
    if (componentes.includes('pericias') && !temp.periciasColetadas) {
        const { solicitarPericia } = require('./skillInputHandler');
        return solicitarPericia(interaction, subtipoChave);
    }

    // Caso contrário, vai para o modo do dado
    return perguntarModoDado(interaction, subtipoChave);
}

module.exports = { avancarProximoPasso };