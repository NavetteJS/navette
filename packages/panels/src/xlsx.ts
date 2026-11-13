// Minimal XLSX writer: one worksheet of text cells (inline strings), zipped with Node's zlib. Cells are never formulas, so
// spreadsheet software does not evaluate them; numbers stay text, as in Filament's export.
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

/** Escapes a value for XML; characters not allowed in XML 1.0 are dropped. */
const xml = (value: string) => value.replace(/[^\x09\x0A\x0D\x20-퟿-�\u{10000}-\u{10FFFF}]/gu, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Column letters of a 0-based index: 0 → A, 26 → AA. */
function columnName(index: number): string {
    let name = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    return name;
}

/** Workbook with a single sheet: the first row is bold (header). */
export function buildXlsx(rows: unknown[][], sheetName = 'Sheet1'): Buffer {
    const sheetRows = rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => `<c r="${columnName(c)}${r + 1}" t="inlineStr"${r === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(cell === null || cell === undefined ? '' : String(cell)).slice(0, 32767)}</t></is></c>`).join('')}</row>`).join('');
    const files: [string, string][] = [
        ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
        ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
        ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)) || 'Sheet1'}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
        ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
        ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>'],
        ['xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`],
    ];
    return zip(files.map(([name, content]) => [name, Buffer.from(content, 'utf8')]));
}

/** ZIP archive (deflate), as required by the XLSX format. */
function zip(entries: [string, Buffer][]): Buffer {
    const locals: Buffer[] = [], centrals: Buffer[] = [];
    let offset = 0;
    for (const [name, data] of entries) {
        const nameBuffer = Buffer.from(name, 'utf8');
        const compressed = deflateRawSync(data);
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
        local.writeUInt32LE(0, 10); local.writeUInt32LE(crc >>> 0, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBuffer.length, 26); local.writeUInt16LE(0, 28);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
        central.writeUInt32LE(0, 12); central.writeUInt32LE(crc >>> 0, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBuffer.length, 28); central.writeUInt32LE(offset, 42);
        locals.push(local, nameBuffer, compressed);
        centrals.push(central, nameBuffer);
        offset += local.length + nameBuffer.length + compressed.length;
    }
    const centralSize = centrals.reduce((size, buffer) => size + buffer.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, ...centrals, end]);
}

// ------------------------------------------------------------------ reading

/** Files of a ZIP archive (stored or deflated entries), read from its central directory. Each entry is limited in size. */
function unzip(archive: Buffer, maxEntryBytes: number): Map<string, Buffer> {
    const files = new Map<string, Buffer>();
    let end = -1;
    for (let i = archive.length - 22; i >= Math.max(0, archive.length - 65557); i--) if (archive.readUInt32LE(i) === 0x06054b50) { end = i; break; }
    if (end < 0) throw new Error('Not a ZIP archive.');
    const count = archive.readUInt16LE(end + 10);
    let pointer = archive.readUInt32LE(end + 16);
    for (let index = 0; index < count && index < 10_000; index++) {
        if (archive.readUInt32LE(pointer) !== 0x02014b50) throw new Error('Damaged ZIP archive.');
        const method = archive.readUInt16LE(pointer + 10), compressedSize = archive.readUInt32LE(pointer + 20), size = archive.readUInt32LE(pointer + 24);
        const nameLength = archive.readUInt16LE(pointer + 28), extraLength = archive.readUInt16LE(pointer + 30), commentLength = archive.readUInt16LE(pointer + 32);
        const localOffset = archive.readUInt32LE(pointer + 42);
        const name = archive.subarray(pointer + 46, pointer + 46 + nameLength).toString('utf8');
        pointer += 46 + nameLength + extraLength + commentLength;
        if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Damaged ZIP archive.');
        const dataStart = localOffset + 30 + archive.readUInt16LE(localOffset + 26) + archive.readUInt16LE(localOffset + 28);
        const data = archive.subarray(dataStart, dataStart + compressedSize);
        if (size > maxEntryBytes) throw new Error('XLSX file too large.');
        if (method === 0) files.set(name, Buffer.from(data));
        else if (method === 8) files.set(name, inflateRawSync(data, { maxOutputLength: maxEntryBytes }));
    }
    return files;
}
const unescapeXml = (text: string) => text.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === 'lt') return '<'; if (lower === 'gt') return '>'; if (lower === 'quot') return '"'; if (lower === 'apos') return "'"; if (lower === 'amp') return '&';
    const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : '';
});
/** Text of the `<t>` elements of a shared or inline string (rich text runs joined, phonetic runs skipped). */
const stringOf = (xmlText: string) => [...xmlText.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map((match) => unescapeXml(match[1] ?? '')).join('');
const columnIndex = (reference: string) => { let index = 0; for (const char of reference.replace(/\d+$/, '').toUpperCase()) index = index * 26 + (char.charCodeAt(0) - 64); return index - 1; };

/**
 * Rows of the first worksheet of an XLSX file, as text (numbers as written, booleans as `1`/`0`, formulas as their cached
 * value). Stops after `maxRows` rows. Throws on a file that is not a valid workbook.
 */
export function readXlsx(archive: Buffer, maxRows = Infinity, maxEntryBytes = 100 * 1024 * 1024): string[][] {
    const files = unzip(archive, maxEntryBytes);
    const text = (name: string) => files.get(name)?.toString('utf8') ?? null;
    const workbook = text('xl/workbook.xml');
    if (!workbook) throw new Error('Not an XLSX workbook.');
    const firstSheet = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
    const relations = text('xl/_rels/workbook.xml.rels') ?? '';
    // The relationship of the first sheet, whatever the order of its attributes.
    const relation = firstSheet ? [...relations.matchAll(/<Relationship\s([^>]*)>/g)].map((match) => match[1]).find((attributes) => /\bId="([^"]+)"/.exec(attributes)?.[1] === firstSheet) : undefined;
    let target = relation ? /\bTarget="([^"]+)"/.exec(relation)?.[1] ?? null : null;
    target ??= 'worksheets/sheet1.xml';
    const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    const sheet = text(sheetPath);
    if (!sheet) throw new Error('The workbook has no worksheet.');
    const shared = [...(text('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => stringOf(match[1]));
    const rows: string[][] = [];
    for (const rowMatch of sheet.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
        if (rows.length >= maxRows) break;
        const row: string[] = [];
        let next = 0;
        for (const cell of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const attributes = cell[1], body = cell[2] ?? '';
            const reference = /\br="([A-Z]+\d+)"/i.exec(attributes)?.[1];
            const index = reference ? columnIndex(reference) : next;
            if (index > 16384) continue;
            const type = /\bt="([^"]+)"/.exec(attributes)?.[1] ?? 'n';
            const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
            const value = type === 's' ? (shared[Number(raw)] ?? '') : type === 'inlineStr' ? stringOf(body) : type === 'b' ? (raw === '1' ? '1' : '0') : unescapeXml(raw ?? '');
            while (row.length < index) row.push('');
            row[index] = value;
            next = index + 1;
        }
        rows.push(row);
    }
    // Trailing empty rows are dropped.
    while (rows.length && rows[rows.length - 1].every((cell) => cell === '')) rows.pop();
    return rows;
}
