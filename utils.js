/**
 * Parses Linux PSI (Pressure Stall Information) memory metrics.
 * Extracts 'avg10' values for 'some' and 'full' pressure states.
 *
 * @param {string|Uint8Array} contents - The contents of /proc/pressure/memory.
 * @returns {{some: number, full: number}|null} Object containing PSI metrics, or null if parsing fails.
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
 * Deterministically calculates the active physical memory (RAM) usage percentage,
 * excluding system caches and buffers to get an accurate representation.
 *
 * @param {number} total - Total physical memory in bytes (from GTop).
 * @param {number} free - Raw free memory in bytes (from GTop).
 * @param {number} cached - Cached memory in bytes (from GTop).
 * @param {number} buffer - Buffered memory in bytes (from GTop).
 * @returns {number} Integer representing the memory usage percentage [0-100].
 */
export function calculateMemoryPercentage(total, free, cached, buffer) {
    if (total <= 0) return 0;
    let usedMem = total - free - cached - buffer;
    return Math.floor((usedMem / total) * 100);
}

/**
 * Decodes a null-terminated C char array (\0) into a clean, readable JavaScript string.
 * Typically used to parse command strings returned by GTop.
 *
 * @param {number[]} cmdBytes - Array of character codes in ASCII/UTF-8 format.
 * @returns {string} The decoded command string.
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
