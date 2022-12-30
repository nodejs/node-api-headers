const { createWriteStream } = require('fs');
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const { resolve } = require('path');
const { parseArgs } = require('util')

async function getLatestReleaseVersion() {
    const response = await fetch('https://nodejs.org/download/release/index.json');
    const json = await response.json();
    return json[0].version;
}

async function main() {
    const { values: { tag, verbose } } = parseArgs({
        options: {
            tag: {
                type: "string",
                short: "t",
                default: await getLatestReleaseVersion()
            },
            verbose: {
                type: "boolean",
                short: "v",
            },
        },
    });

    console.log(`Update headers from nodejs/node tag ${tag}`);

    const files = ['js_native_api_types.h', 'js_native_api.h', 'node_api_types.h', 'node_api.h'];

    for (const filename of files) {
        const url = `https://raw.githubusercontent.com/nodejs/node/${tag}/src/${filename}`;
        const path = resolve(__dirname, '..', 'include', filename);

        if (verbose) {
            console.log(`  ${url} -> ${path}`);
        }

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
