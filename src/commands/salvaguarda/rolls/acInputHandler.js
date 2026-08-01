// O sistema de CA é automático, capturado da ficha ativa do personagem.
function processarSistemaCa(configObj) {
    configObj.sistemaCa = true;
    return configObj;
}

module.exports = { processarSistemaCa };