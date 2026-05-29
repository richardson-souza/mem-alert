/**
 * Realiza o parsing de dados de PSI (Pressure Stall Information) de memória.
 * Extrai os valores 'avg10' para as métricas 'some' e 'full'.
 *
 * @param {string|Uint8Array} contents - Conteúdo do arquivo /proc/pressure/memory.
 * @returns {{some: number, full: number}|null} Objeto contendo os valores de PSI ou null em caso de erro de parsing.
 */
export function parsePSI(contents) {
    if (!contents) return null;
    try {
        const text = typeof contents === 'string' ? contents : new TextDecoder().decode(contents);
        const lines = text.split('\n');
        if (lines.length < 2) return null;
        let someMatch = lines[0].match(/avg10=([\d.]+)/);
        let fullMatch = lines[1].match(/avg10=([\d.]+)/);
        if (!someMatch && !fullMatch) return null;
        return {
            some: someMatch ? parseFloat(someMatch[1]) : 0,
            full: fullMatch ? parseFloat(fullMatch[1]) : 0
        };
    } catch (e) {
        return null;
    }
}

/**
 * Calcula dinamicamente o percentual de RAM em uso de forma determinística,
 * descontando a memória alocada para caches e buffers.
 *
 * @param {number} total - Memória física total em bytes (GTop).
 * @param {number} free - Memória livre em bytes (GTop).
 * @param {number} cached - Memória em cache em bytes (GTop).
 * @param {number} buffer - Memória em buffers em bytes (GTop).
 * @returns {number} Percentual inteiro de memória em uso [0-100].
 */
export function calculateMemoryPercentage(total, free, cached, buffer) {
    if (total <= 0) return 0;
    let usedMem = total - free - cached - buffer;
    return Math.floor((usedMem / total) * 100);
}

/**
 * Decodifica um array de bytes C terminados em caractere nulo (\0)
 * para uma string JS legível. Utilizado com retornos do GTop.
 *
 * @param {number[]} cmdBytes - Array com o código de caracteres em formato ASCII.
 * @returns {string} String do comando decodificado.
 */
export function decodeCmd(cmdBytes) {
    if (!cmdBytes) return '';
    let cmdString = '';
    for (let i = 0; i < cmdBytes.length; i++) {
        if (cmdBytes[i] === 0) break;
        cmdString += String.fromCharCode(cmdBytes[i]);
    }
    return cmdString;
}
