const { exec, spawn } = require("node:child_process");
const { createReadStream } = require("node:fs");
const { createInterface } = require("node:readline");
const { resolve: resolvePath } = require("node:path");
const { writeFile } = require("node:fs/promises");

/**
 * Returns a string of the new changelog entries by running `npx changelog-maker
 * --format=markdown`.
 *
 * @returns {Promise<string>}
 */
async function getNewChangelogEntries() {
    const { stdout, stderr } = await new Promise((resolve, reject) => {
        // Echo an empty string to pass as the GitHub Personal Access Token
        // (PAT). This causes the process to error if no PAT is found in the
        // changelog-maker configuration file.
        exec("echo '' | npx changelog-maker --format=markdown", (err, stdout, stderr) => {
            if (err) {
                reject(err);
            } else {
                resolve({ stdout, stderr });
            }
        });

    });

    return { stdout, stderr };
}

/**
 * Returns the text of the changelog file, excluding header lines.
 *
 * @param {string} changelogPath Path to changelog file
 * @returns {Promise<string>}
 */
async function getExistingChangelogText(changelogPath) {
    const data = await new Promise((resolve, reject) => {
        try {
            const rl = createInterface(createReadStream(changelogPath));

            let lines = "";
            let lineNumber = 1;

            rl.on('line', function (line) {
                if (lineNumber > 2) {
                    lines += line + "\n";
                }

                lineNumber++;
            });

            rl.on('close', () => {
                resolve(lines);
            });

            rl.on('error', (err) => {
                reject(err);
            });

        } catch (e) {
            reject(e);
        }
    });

    return data;
}


/**
 * Returns the string for the new changelog file.
 *
 * @param {string} newEntries New changelog entries
 * @param {string} existingText Existing changelog text
 * @param {string} author Author of the release
 * @returns {string}
 */
function generateChangelogText(newEntries, existingText, author = "github-actions\\[bot]") {
    const packageVersion = require("../package.json").version;
    const currentDateString = new Date().toISOString().split(/T/)[0];

    const notableChanges = Array.from(newEntries.matchAll(/ (- [^(]+) \([^)]+\)( \[#\d+]\([^)]+\))?/g))
        .map(matches => matches[1])
        .join("\n");

    return `# node-api-headers Changelog

## ${currentDateString} Version ${packageVersion}, ${author}

### Notable changes

${notableChanges}

### Commits

${newEntries.trim()}

${existingText.trim()}
`;
}

/**
 * Throws an error (asynchronously) if there are uncommitted changes to the changelog file.
 *
 * @param {string} changelogPath Path to changelog file
 * @returns {Promise<void>}
 */
function assertCleanChangelog(changelogPath) {
    return new Promise((resolve, reject) => {
        const spawned = spawn("git", ["diff", "--quiet", changelogPath]);
        spawned.on('exit', function (exitCode) {
            if (exitCode === 0) {
                resolve(undefined);
            } else {
                reject(new Error(`There are uncommitted changes to ${changelogPath}. Commit, revert, or stash changes first.`));
            }
        });

        spawned.on('error', function (err) {
            reject(err);
        });
    });
}

async function main() {
    const changelogPath = resolvePath(__dirname, "..", "CHANGELOG.md");
    await assertCleanChangelog(changelogPath);
    const [{ stdout: newEntires, stderr }, existingText] = await Promise.all([getNewChangelogEntries(), getExistingChangelogText(changelogPath)]);
    const changelogText = generateChangelogText(newEntires, existingText);

    await writeFile(changelogPath, changelogText);
    if (stderr) {
        console.error("stderr from changelog-maker:\n", stderr)
    }
    console.log(`Changelog written to ${changelogPath}`);
}

main().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
