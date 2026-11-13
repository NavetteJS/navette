// Minimal XLSX writer: one worksheet of text cells (inline strings), zipped with Node's zlib. Cells are never formulas, so
// spreadsheet software does not evaluate them; numbers stay text, as in Filament's export.
import { crc32, deflateRawSync } from 'node:zlib';

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
