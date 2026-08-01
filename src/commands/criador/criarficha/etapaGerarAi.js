const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../../../database');
const config = require('../../../config');

async function gerarFichaComAi(session) {
    const interaction = session.interaction;

    const loadingEmbed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('⏳ Gerando Ficha com IA...')
        .setDescription('A IA está processando as regras do seu sistema de RPG, os limites e a sua descrição para montar a ficha perfeita. Aguarde um instante...');

    await interaction.editReply({ embeds: [loadingEmbed], components: [] });

    const configPath = path.join(process.cwd(), 'configs_npcs', `${session.data.configId}.json`);
    let configLimits = {};
    if (fs.existsSync(configPath)) {
        try {
            configLimits = JSON.parse(fs.readFileSync(configPath, 'utf8')).configData || {};
        } catch (e) {}
    }

    const sys = db.prepare('SELECT * FROM rpg_systems WHERE id = ?').get(session.systemId);
    let systemFullConfig = {};
    if (sys && sys.config) {
        try { systemFullConfig = JSON.parse(sys.config); } catch (e) {}
    }

    // Função recursiva para remover qualquer chave que contenha "max" (ignorando maiúsculas/minúsculas)
    const removerChavesMax = (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
            return obj.map(removerChavesMax);
        }
        const novoObjeto = {};
        for (const [key, value] of Object.entries(obj)) {
            if (key.toLowerCase().includes('max')) {
                continue; // Pula a chave que contém "max"
            }
            novoObjeto[key] = removerChavesMax(value);
        }
        return novoObjeto;
    };

    // Aplica a remoção em systemFullConfig
    systemFullConfig = removerChavesMax(systemFullConfig);

    // Função para formatar itens no padrão "Nome\n Chance: X%" caso venham como "Nome:X"
    const formatarItemTexto = (texto) => {
        if (!texto || typeof texto !== 'string') return texto;
        const match = texto.match(/^(.+?)\s*:\s*(\d+)$/);
        if (match) {
            const nomeItem = match[1].trim();
            const porcentagem = match[2].trim();
            return `${nomeItem}\n Chance: ${porcentagem}%`;
        }
        return texto;
    };

    // Processamento e formatação dos itens de loot do usuário
    let itensFormatados = session.data.itensDrop || 'Nenhum';
    if (typeof itensFormatados === 'string' && itensFormatados !== 'Nenhum') {
        itensFormatados = itensFormatados
            .split(/\r?\n|,/)
            .map(i => i.trim())
            .filter(Boolean)
            .map(formatarItemTexto);
    } else if (Array.isArray(itensFormatados)) {
        itensFormatados = itensFormatados.map(formatarItemTexto);
    }

    const formatarListaLoot = (lista) => {
        if (!lista) return [];
        if (Array.isArray(lista)) {
            return lista.map(item => {
                if (typeof item === 'string') return formatarItemTexto(item);
                return item;
            });
        }
        return lista;
    };

    const dinheiroFormatado = formatarItemTexto(session.data.dinheiroDrop) || 'Nenhum';
    const xpFinal = session.data.xpDesejado ? session.data.xpQuantidade : 0;

    const promptPayload = {
        tipo: session.data.tipo,
        nomeDesejado: session.data.nome,
        descricaoUsuario: session.data.descricaoAi,
        limitesConfiguracao: configLimits,
        recursosExtrasConfigurados: session.data.recursos,
        xp: xpFinal,
        loot: {
            itens: itensFormatados,
            armas: formatarListaLoot(session.data.armasDrop),
            armaduras: formatarListaLoot(session.data.armadurasDrop),
            dinheiro: dinheiroFormatado
        },
        regrasSistemaCompleto: systemFullConfig
    };

    const apiKey = process.env.GEMINI_API_KEY || config.geminiApiKey;

    const promptText = `Você é um gerador experto de fichas de RPG. 

ATENÇÃO CRUCIAL 1 (NARRATIVA E PERFIL): 
Você DEVE seguir RIGOROSAMENTE a descrição fornecida pelo usuário ("descricaoUsuario") para definir os pontos fortes, fracos, distribuição de atributos e perícias do personagem. 
- Se a descrição diz que o personagem foca em inteligência e tem baixa força física, os atributos mentais e as perícias mentais/sociais DEVEM refletir isso claramente.
- Não crie um personagem focado em combate genérico se a descrição indicar outro foco, fraqueza ou especialidade.

ATENÇÃO CRUCIAL 2 (LIMITES MÍNIMOS E MÁXIMOS - HARD CAP OBRIGATÓRIO):
- Você DEVE seguir estritamente os limites de valores definidos em "limitesConfiguracao" (como mínimo e máximo para Atributos, Perícias, PV, PM, etc.).
- O valor de QUALQUER atributo ou perícia gerado JAMAIS pode ser menor que o limite mínimo estabelecido e JAMAIS pode ser maior que o limite máximo estabelecido. Isso é um HARD CAP absoluto e obrigatório. Ignore quaisquer valores padrão externos ou restrições antigas que violem esses limites configurados pelo usuário.

ATENÇÃO CRUCIAL 3 (LOOT E XP SÃO MANUAIS): 
- Você NÃO DEVE inventar, criar ou modificar itens de loot ou valores de XP. Mantenha exatamente o que foi fornecido no payload.
- A sua função é preencher apenas a parte técnica da ficha (atributos, perícias, PV, PM e recursos extras) com base nas regras do sistema e na descrição.

Analise detalhadamente o JSON de regras do sistema, os limites de criação e os dados abaixo. Crie a ficha completa de ${promptPayload.tipo} para o personagem "${promptPayload.nomeDesejado}".

Retorne APENAS um objeto JSON válido, sem códigos markdown (sem \`\`\`json), contendo toda a ficha estruturada.

Dados do Sistema e Reunião:
${JSON.stringify(promptPayload, null, 2)}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error('Erro retornado pela API do Gemini:', data.error);
            throw new Error(data.error.message || 'Erro desconhecido na API');
        }

        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        
        let cleanedJson = candidateText
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();

        const firstIndex = cleanedJson.indexOf('{');
        const lastIndex = cleanedJson.lastIndexOf('}');
        if (firstIndex !== -1 && lastIndex !== -1 && lastIndex > firstIndex) {
            cleanedJson = cleanedJson.substring(firstIndex, lastIndex + 1);
        }

        let fichaJson = {};
        try {
            fichaJson = JSON.parse(cleanedJson);
            
            // GARANTIA FINAL: Sobrescrevemos o loot e o XP na ficha gerada com os dados limpos e formatados do usuário
            fichaJson.xp = xpFinal;
            fichaJson.loot = {
                itens: itensFormatados,
                armas: formatarListaLoot(session.data.armasDrop),
                armaduras: formatarListaLoot(session.data.armadurasDrop),
                dinheiro: dinheiroFormatado
            };
        } catch (parseErr) {
            console.error('Erro ao fazer parse do JSON da IA:', parseErr, '\Texto bruto recebido:', candidateText);
            fichaJson = { 
                nome: session.data.nome, 
                descricao: session.data.descricaoAi, 
                xp: xpFinal,
                loot: {
                    itens: itensFormatados,
                    armas: formatarListaLoot(session.data.armasDrop),
                    armaduras: formatarListaLoot(session.data.armadurasDrop),
                    dinheiro: dinheiroFormatado
                },
                erroParse: "A IA gerou um formato inválido, mas o texto bruto foi salvo.",
                rawAiOutput: candidateText 
            };
        }

        const tableName = session.data.tipo === 'inimigo' ? 'lista_ficha_inimigos' : 'lista_ficha_npcs';
        db.prepare(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id TEXT PRIMARY KEY,
                userId TEXT,
                guildId TEXT,
                systemId TEXT,
                name TEXT,
                sheetData TEXT,
                createdAt TEXT
            )
        `).run();

        const sheetId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        db.prepare(`
            INSERT INTO ${tableName} (id, userId, guildId, systemId, name, sheetData, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(sheetId, interaction.user.id, interaction.guild.id, session.systemId, session.data.nome, JSON.stringify(fichaJson), new Date().toISOString());

        const jsonStringified = JSON.stringify(fichaJson, null, 2);
        const truncatedJson = jsonStringified.length > 1500 ? jsonStringified.substring(0, 1500) + '\n...' : jsonStringified;

        const successEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle(`✅ Ficha de ${session.data.tipo === 'inimigo' ? 'Inimigo' : 'NPC'} Criada com Sucesso!`)
            .setDescription(
                `**Nome:** ${session.data.nome}\n` +
                `**Tipo:** ${session.data.tipo.toUpperCase()}\n` +
                `**Salvo na Database:** \`${tableName}\`\n\n` +
                `**Ficha Gerada pela IA:**\n\`\`\`json\n${truncatedJson}\n\`\`\``
            );

        await interaction.editReply({ embeds: [successEmbed], components: [] });
    } catch (err) {
        console.error('Erro crítico ao gerar ficha com IA:', err);
        const errEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('❌ Erro na API da IA')
            .setDescription(`Ocorreu um erro ao comunicar com a IA do Gemini:\n\`\`\`${err.message}\`\`\``);
        await interaction.editReply({ embeds: [errEmbed] });
    }

    require('./sessionCriarficha').clearSession(interaction.user.id);
}

module.exports = {
    gerarFichaComAi
};