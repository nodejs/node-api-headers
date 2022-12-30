const { createWriteStream } = require('fs');
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const { resolve } = require('path');

const files = ['js_native_api_types.h', 'js_native_api.h', 'node_api_types.h', 'node_api.h'];

const commit = process.argv[2] ?? 'main';

console.log(`Using commit ${commit}:`);

async function main() {
    for (const filename of files) {
        const url = `https://raw.githubusercontent.com/nodejs/node/${commit}/src/${filename}`;
        const path = resolve(__dirname, '..', 'include', filename);
        console.log(`  ${url} -> ${path}`);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Fetch of ${url} returned ${response.status} ${response.statusText}`);
        }

        const stream = createWriteStream(path);
        await finished(Readable.fromWeb(response.body).pipe(stream));
    }
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
