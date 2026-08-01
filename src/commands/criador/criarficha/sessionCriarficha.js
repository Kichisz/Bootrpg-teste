const sessions = new Map();

function getSession(userId) {
    if (!sessions.has(userId)) {
        sessions.set(userId, {
            userId: userId,
            step: null,
            interaction: null,
            data: {
                configId: null,
                tipo: null,
                tableName: null,
                nome: null,
                recursos: {},
                xpDesejado: null,
                xpQuantidade: 0,
                lootTipos: [],
                itensDrop: '',
                armasDrop: [],
                armadurasDrop: [],
                dinheiroDrop: '',
                descricaoAi: ''
            },
            tempWeapon: {},
            tempArmor: {}
        });
    }
    return sessions.get(userId);
}

function clearSession(userId) {
    sessions.delete(userId);
}

module.exports = {
    getSession,
    clearSession
};