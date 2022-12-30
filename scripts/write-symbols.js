const { spawnSync } = require('child_process');
const { resolve } = require('path');
const { writeFileSync } = require('fs');

function getSymbolsForVersion(version) {
    const spawned = spawnSync('clang',
        ['-Xclang', '-ast-dump=json', '-fsyntax-only', '-fno-diagnostics-color', version ? `-DNAPI_VERSION=${version}` : '-DNAPI_EXPERIMENTAL', resolve(__dirname, '..', 'include', 'node_api.h')],
        { maxBuffer: 2_000_000 }
    );

    if (spawned.error) {
        if (spawned.error.code === 'ENOENT') {
            throw new Error('This tool requires clang to be installed.');
        }
        throw spawned.error;
    } else if (spawned.stderr.length > 0) {
        throw new Error(spawned.stderr.toString('utf-8'));
    }

    const ast = JSON.parse(spawned.stdout.toString('utf-8'));
    const symbols = { js_native_api_symbols: [], node_api_symbols: [] };

    for (const statement of ast.inner) {
        if (statement.kind !== 'FunctionDecl') {
            continue;
        }

        const name = statement.name;
        const file = statement.loc.includedFrom?.file;

        if (file) {
            symbols.js_native_api_symbols.push(name);
        } else {
            symbols.node_api_symbols.push(name);
        }
    }

    symbols.js_native_api_symbols.sort();
    symbols.node_api_symbols.sort();

    return symbols;
}


function getAllSymbols() {
    const allSymbols = {};
    let version = 1;

    console.log('Processing symbols from clang:')
    while (true) {
        const symbols = getSymbolsForVersion(version);

        if (version > 1) {
            const previousSymbols = allSymbols[`v${version - 1}`];
            if (previousSymbols.js_native_api_symbols.length == symbols.js_native_api_symbols.length && previousSymbols.node_api_symbols.length === symbols.node_api_symbols.length) {
                --version;
                break;
            }
        }
        allSymbols[`v${version}`] = symbols;
        console.log(`  v${version}: ${symbols.js_native_api_symbols.length} js_native_api_symbols, ${symbols.node_api_symbols.length} node_api_symbols`);
        ++version;
    }

    const symbols = allSymbols[`experimental`] = getSymbolsForVersion();
    console.log(`  Experimental: ${symbols.js_native_api_symbols.length} js_native_api_symbols, ${symbols.node_api_symbols.length} node_api_symbols`);
    return {
        maxVersion: version,
        symbols: allSymbols
    };
}

function getUniqueSymbols(previousSymbols, currentSymbols) {
    const symbols = { js_native_api_symbols: [], node_api_symbols: [] };
    for (const symbol of currentSymbols.js_native_api_symbols) {
        if (!previousSymbols.js_native_api_symbols.includes(symbol)) {
            symbols.js_native_api_symbols.push(symbol);
        }
    }
    for (const symbol of currentSymbols.node_api_symbols) {
        if (!previousSymbols.node_api_symbols.includes(symbol)) {
            symbols.node_api_symbols.push(symbol);
        }
    }
    return symbols;
}

function joinSymbols(symbols, prependNewLine) {
    if (symbols.length === 0) return '';
    return `${prependNewLine ? ',\n        ' : ''}'${symbols.join("',\n        '")}'`;
}

function getSymbolData() {
    const { maxVersion, symbols } = getAllSymbols();

    let data = `'use strict'

const v1 = {
    js_native_api_symbols: [
        ${joinSymbols(symbols.v1.js_native_api_symbols)}
    ],
    node_api_symbols: [
        ${joinSymbols(symbols.v1.node_api_symbols)}
    ]
}
`;

    for (let version = 2; version <= maxVersion + 1; ++version) {
        const newSymbols = getUniqueSymbols(symbols[`v${version - 1}`], symbols[version === maxVersion + 1 ? 'experimental' : `v${version}`]);

        data += `
const ${version === maxVersion + 1 ? 'experimental' : `v${version}`} = {
    js_native_api_symbols: [
        ...v${version - 1}.js_native_api_symbols${joinSymbols(newSymbols.js_native_api_symbols, true)}
    ],
    node_api_symbols: [
        ...v${version - 1}.node_api_symbols${joinSymbols(newSymbols.node_api_symbols, true)}
    ]
}
`;
    }

    data += `
module.exports = {
    ${new Array(maxVersion).fill(undefined).map((_, i) => `v${i + 1}`).join(',\n    ')},
    experimental
}
`
    return data;
}

function main() {
    const path = resolve(__dirname, '../symbols.js');
    const data = getSymbolData();
    console.log(`Writing symbols to ${path}`)
    writeFileSync(path, data);
}

try {
    main();
} catch (e) {
    console.error(e);
    process.exitCode = 1;
}
