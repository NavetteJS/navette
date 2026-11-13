// Hidden terminal input, for passwords.
/**
 * Reads a hidden answer in raw mode: each typed character shows as a dot, so the password never appears on screen.
 * Backspace erases, Enter validates, Ctrl+C quits; escape sequences (arrow keys) are ignored.
 */
export function readSecret(label: string, input: NodeJS.ReadStream = process.stdin, output: NodeJS.WriteStream = process.stdout): Promise<string> {
    output.write(label);
    const wasRaw = input.isRaw === true;
    input.setRawMode?.(true);
    input.setEncoding('utf8');
    input.resume();
    return new Promise((resolve) => {
        let value = '';
        const onData = (chunk: string) => {
            if (chunk.startsWith('\x1b')) return;
            for (const character of chunk) {
                if (character === '\r' || character === '\n') { input.off('data', onData); input.setRawMode?.(wasRaw); input.pause(); output.write('\n'); resolve(value); return; }
                if (character === '\u0003') { input.setRawMode?.(wasRaw); output.write('\n'); process.exit(130); }
                if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
                else if (character >= ' ') value += character;
            }
            output.write(`\r\x1b[K${label}${'•'.repeat(value.length)}`);
        };
        input.on('data', onData);
    });
}
