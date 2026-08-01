const sessionCriador = require('./sessionCriador');

async function processarPericias(message, session) {
    const texto = message.content.trim();
    try { await message.delete(); } catch (e) {}

    if (session.step === 'PERICIA_MIN') {
        const minVal = Number(texto);
        if (isNaN(minVal)) {
            return message.reply({ content: '❌ Por favor, digite um número válido.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 4000));
        }
        session.data.periciaMin = minVal;
    } else if (session.step === 'PERICIA_MAX') {
        const maxVal = Number(texto);
        if (isNaN(maxVal)) {
            return message.reply({ content: '❌ Por favor, digite um número válido.' }).then(m => setTimeout(() => m.delete().catch(()=>{}), 4000));
        }
        session.data.periciaMax = maxVal;
    }

    await sessionCriador.avancarProximoPasso(message, session);
}

module.exports = {
    processarPericias
};