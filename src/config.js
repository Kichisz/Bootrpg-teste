const path = require('path');
const dotenv = require('dotenv');

// Força a leitura do .env na pasta raiz (bootrpg)
const result = dotenv.config({ path: path.join(__dirname, '../.env') });

if (result.error || !process.env.TOKEN) {
    console.error("\n[ERRO DE CONFIGURAÇÃO] O arquivo .env não foi lido corretamente ou o TOKEN está faltando!");
    console.error("Certifique-se de que o arquivo se chama exatamente '.env' (com o ponto na frente) e está na pasta raiz 'bootrpg'.\n");
}

module.exports = {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    testGuildId: process.env.TEST_GUILD_ID,
    geminiApiKey: "AQ.Ab8RN6KUU6V1S3O1PF44z8fObN0135oK_QwHsOcm_-C8ZhYpkQ",
};