const configsTemp = new Map();

function setConfigTemp(userId, subtipoChave, dados) {
    const key = `${userId}_${subtipoChave}`;
    const atual = configsTemp.get(key) || {};
    
    const globalNpcKey = `${userId}_temp_is_npc`;
    const globalNpc = configsTemp.get(globalNpcKey);
    let extra = {};
    if (globalNpc && globalNpc.isNpc && subtipoChave !== '_temp_is_npc') {
        extra.isNpc = true;
        if (globalNpc.sistemaNome) {
            extra.sistemaNome = globalNpc.sistemaNome;
        }
    }

    configsTemp.set(key, { ...atual, ...extra, ...dados });
}

function getConfigTemp(userId, subtipoChave) {
    const key = `${userId}_${subtipoChave}`;
    const config = configsTemp.get(key) || {};
    
    if (config.isNpc === undefined) {
        const globalNpcKey = `${userId}_temp_is_npc`;
        const globalNpc = configsTemp.get(globalNpcKey);
        if (globalNpc && globalNpc.isNpc) {
            config.isNpc = true;
            if (globalNpc.sistemaNome && !config.sistemaNome) {
                config.sistemaNome = globalNpc.sistemaNome;
            }
        }
    }

    return config;
}

function limparConfigTemp(userId, subtipoChave) {
    const key = `${userId}_${subtipoChave}`;
    configsTemp.delete(key);
}

module.exports = { setConfigTemp, getConfigTemp, limparConfigTemp };