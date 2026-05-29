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

export function calculateMemoryPercentage(total, free, cached, buffer) {
    if (total <= 0) return 0;
    let usedMem = total - free - cached - buffer;
    return Math.floor((usedMem / total) * 100);
}

export function decodeCmd(cmdBytes) {
    if (!cmdBytes) return '';
    let cmdString = '';
    for (let i = 0; i < cmdBytes.length; i++) {
        if (cmdBytes[i] === 0) break;
        cmdString += String.fromCharCode(cmdBytes[i]);
    }
    return cmdString;
}
