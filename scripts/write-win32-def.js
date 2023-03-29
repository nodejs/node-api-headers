'use strict';

const { resolve: resolvePath } = require('path');
const { writeFile } = require('fs/promises');
const { symbols } = require('..');

function getNodeApiDef() {
    const symbolsSet = new Set();
    for (const ver of Object.values(symbols)) {
        for (const sym of ver.node_api_symbols) {
            symbolsSet.add(sym);
        }
        for (const sym of ver.js_native_api_symbols) {
            symbolsSet.add(sym);
        }
    }
    return 'NAME NODE.EXE\nEXPORTS\n' + Array.from(symbolsSet).join('\n');
}

function getJsNativeApiDef() {
    const symbolsSet = new Set();
    for (const ver of Object.values(symbols)) {
        for (const sym of ver.js_native_api_symbols) {
            symbolsSet.add(sym);
        }
    }
    return 'NAME NODE.EXE\nEXPORTS\n' + Array.from(symbolsSet).join('\n');
}

async function main() {
    const nodeApiDefPath = resolvePath(__dirname, '../node_api.def');
    console.log(`Writing Windows .def file to ${nodeApiDefPath}`);
    await writeFile(nodeApiDefPath, getNodeApiDef());

    const jsNativeApiDefPath = resolvePath(__dirname, '../js_native_api.def');
    console.log(`Writing Windows .def file to ${jsNativeApiDefPath}`);
    await writeFile(jsNativeApiDefPath, getJsNativeApiDef());
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
