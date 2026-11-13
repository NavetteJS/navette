// QR Code generator (ISO/IEC 18004), byte mode, versions 1 to 40, rendered as SVG. No dependency.
// Follows the structure of Project Nayuki's QR Code generator (https://www.nayuki.io/page/qr-code-generator-library):
// Copyright (c) Project Nayuki. MIT License: permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files, to deal in the Software without restriction, subject to including this
// notice; the Software is provided "as is", without warranty of any kind.

export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';
const LEVELS: Record<QrErrorCorrection, { ordinal: number; formatBits: number }> = { L: { ordinal: 0, formatBits: 1 }, M: { ordinal: 1, formatBits: 0 }, Q: { ordinal: 2, formatBits: 3 }, H: { ordinal: 3, formatBits: 2 } };
const ECC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_ERROR_CORRECTION_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const bit = (value: number, index: number): boolean => ((value >>> index) & 1) !== 0;
function rawDataModules(version: number): number {
    let result = (16 * version + 128) * version + 64;
    if (version >= 2) {
        const alignments = Math.floor(version / 7) + 2;
        result -= (25 * alignments - 10) * alignments - 55;
        if (version >= 7) result -= 36;
    }
    return result;
}
const dataCodewords = (version: number, level: number): number => Math.floor(rawDataModules(version) / 8) - ECC_CODEWORDS_PER_BLOCK[level][version] * NUM_ERROR_CORRECTION_BLOCKS[level][version];

// Reed-Solomon over GF(2^8), polynomial 0x11D.
function multiply(x: number, y: number): number {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
    return z & 0xff;
}
function divisor(degree: number): number[] {
    const result = new Array(degree - 1).fill(0).concat([1]);
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < result.length; j++) { result[j] = multiply(result[j], root); if (j + 1 < result.length) result[j] ^= result[j + 1]; }
        root = multiply(root, 0x02);
    }
    return result;
}
function remainder(data: number[], generator: number[]): number[] {
    const result = generator.map(() => 0);
    for (const byte of data) {
        const factor = byte ^ (result.shift() as number);
        result.push(0);
        generator.forEach((coefficient, i) => { result[i] ^= multiply(coefficient, factor); });
    }
    return result;
}

/** Module matrix of a QR Code: `true` for a dark module. Raises an error when the data does not fit (about 2.3 KB at level M). */
export function qrCodeMatrix(text: string | Uint8Array, errorCorrection: QrErrorCorrection = 'M'): boolean[][] {
    const level = LEVELS[errorCorrection];
    if (!level) throw new Error(`Unknown error correction level: ${errorCorrection}`);
    const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
    let version = 1;
    for (; ; version++) {
        if (version > 40) throw new Error('Data too long for a QR Code.');
        const countBits = version <= 9 ? 8 : 16;
        if (4 + countBits + bytes.length * 8 <= dataCodewords(version, level.ordinal) * 8) break;
    }
    // Data bits: byte mode, character count, bytes, terminator, padding.
    const bits: number[] = [];
    const append = (value: number, length: number) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
    append(0b0100, 4);
    append(bytes.length, version <= 9 ? 8 : 16);
    for (const byte of bytes) append(byte, 8);
    const capacity = dataCodewords(version, level.ordinal) * 8;
    append(0, Math.min(4, capacity - bits.length));
    append(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) append(pad, 8);
    const data: number[] = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((byte, b) => (byte << 1) | b, 0));

    // Error correction blocks, interleaved.
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[level.ordinal][version];
    const blockEccLength = ECC_CODEWORDS_PER_BLOCK[level.ordinal][version];
    const rawCodewords = Math.floor(rawDataModules(version) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLength = Math.floor(rawCodewords / numBlocks);
    const generator = divisor(blockEccLength);
    const blocks: number[][] = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
        const block = data.slice(k, k + shortBlockLength - blockEccLength + (i < numShortBlocks ? 0 : 1));
        k += block.length;
        const ecc = remainder(block, generator);
        if (i < numShortBlocks) block.push(0);
        blocks.push(block.concat(ecc));
    }
    const codewords: number[] = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((block, j) => { if (i !== shortBlockLength - blockEccLength || j >= numShortBlocks) codewords.push(block[i]); });

    // Function patterns.
    const size = version * 4 + 17;
    const modules: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFunction: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x: number, y: number, dark: boolean) => { modules[y][x] = dark; isFunction[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
            const distance = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
            if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, distance !== 2 && distance !== 4);
        }
    }
    const alignments: number[] = [];
    if (version > 1) {
        const count = Math.floor(version / 7) + 2;
        const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
        alignments.push(6);
        for (let position = size - 7; alignments.length < count; position -= step) alignments.splice(1, 0, position);
    }
    alignments.forEach((cx, i) => alignments.forEach((cy, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === alignments.length - 1) || (i === alignments.length - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    const drawFormat = (mask: number) => {
        const formatData = (level.formatBits << 3) | mask;
        let rem = formatData;
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        const format = ((formatData << 10) | rem) ^ 0x5412;
        for (let i = 0; i <= 5; i++) set(8, i, bit(format, i));
        set(8, 7, bit(format, 6)); set(8, 8, bit(format, 7)); set(7, 8, bit(format, 8));
        for (let i = 9; i < 15; i++) set(14 - i, 8, bit(format, i));
        for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(format, i));
        for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(format, i));
        set(8, size - 8, true);
    };
    drawFormat(0); // reserves the format areas before the data is placed
    if (version >= 7) {
        let rem = version;
        for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
        const versionBits = (version << 12) | rem;
        for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, bit(versionBits, i)); set(b, a, bit(versionBits, i)); }
    }

    // Codewords, in the zigzag order.
    let index = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vertical = 0; vertical < size; vertical++) for (let j = 0; j < 2; j++) {
            const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vertical : vertical;
            if (!isFunction[y][x] && index < codewords.length * 8) { modules[y][x] = bit(codewords[index >>> 3], 7 - (index & 7)); index++; }
        }
    }

    // Mask: the one with the lowest penalty.
    const masks: ((x: number, y: number) => boolean)[] = [
        (x, y) => (x + y) % 2 === 0, (_x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
        (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
        (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    const applyMask = (mask: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!isFunction[y][x] && masks[mask](x, y)) modules[y][x] = !modules[y][x]; };
    let best = 0, bestPenalty = Infinity;
    for (let mask = 0; mask < 8; mask++) {
        applyMask(mask); drawFormat(mask);
        const score = penalty(modules);
        if (score < bestPenalty) { best = mask; bestPenalty = score; }
        applyMask(mask); // XOR again: undoes the mask
    }
    applyMask(best); drawFormat(best);
    return modules;
}

function penalty(modules: boolean[][]): number {
    const size = modules.length;
    let score = 0;
    const lines: boolean[][] = [...modules, ...modules[0].map((_, x) => modules.map((row) => row[x]))];
    const finderLike = [[true, false, true, true, true, false, true, false, false, false, false], [false, false, false, false, true, false, true, true, true, false, true]];
    for (const line of lines) {
        for (let i = 0, run = 1; i < size; i++, run++) {
            if (i === size - 1 || line[i] !== line[i + 1]) { if (run >= 5) score += 3 + run - 5; run = 0; }
        }
        for (let i = 0; i + 11 <= size; i++) for (const pattern of finderLike) if (pattern.every((dark, k) => line[i + k] === dark)) score += 40;
    }
    for (let y = 0; y + 1 < size; y++) for (let x = 0; x + 1 < size; x++) {
        const color = modules[y][x];
        if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) score += 3;
    }
    const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0), total = size * size;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
}

export type QrCodeSvgOptions = {
    errorCorrection?: QrErrorCorrection;
    /** Quiet zone around the code, in modules (4 by default, as the standard requires). */
    margin?: number;
    dark?: string;
    light?: string;
    /** Accessible name of the image (`<title>`). */
    title?: string | null;
};
const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
/** QR Code as an SVG document (scalable: give it a size with CSS). */
export function qrCodeSvg(text: string, options: QrCodeSvgOptions = {}): string {
    const modules = qrCodeMatrix(text, options.errorCorrection ?? 'M');
    const margin = Math.max(0, Math.floor(options.margin ?? 4));
    const size = modules.length + margin * 2;
    let path = '';
    modules.forEach((row, y) => row.forEach((dark, x) => { if (dark) path += `M${x + margin},${y + margin}h1v1h-1z`; }));
    const color = (value: string | undefined, fallback: string) => escapeXml(value ?? fallback);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${options.title ? `<title>${escapeXml(options.title)}</title>` : ''}<rect width="100%" height="100%" fill="${color(options.light, '#ffffff')}"/><path d="${path}" fill="${color(options.dark, '#000000')}"/></svg>`;
}
/** QR Code as a `data:` URI, for an `<img src>`. */
export const qrCodeDataUri = (text: string, options: QrCodeSvgOptions = {}): string => `data:image/svg+xml;base64,${Buffer.from(qrCodeSvg(text, options)).toString('base64')}`;
