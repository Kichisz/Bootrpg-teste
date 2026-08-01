const sessionCriador = require('./sessionCriador');

async function processarAtributos(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    if (session.step === 'ATRIB_MIN') {
        const minVal = Number(texto);
        if (isNaN(minVal)) {
            return message.reply({ content: '❌ Por favor, digite um número válido.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 4000));
        }
        session.data.atribMin = minVal;
    } else if (session.step === 'ATRIB_MAX') {
        const maxVal = Number(texto);
        if (isNaN(maxVal)) {
            return message.reply({ content: '❌ Por favor, digite um número válido.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 4000));
        }
        session.data.atribMax = maxVal;
    }

    await sessionCriador.avancarProximoPasso(message, session);
}

module.exports = {
    processarAtributos
};