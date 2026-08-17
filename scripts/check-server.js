const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    return entry.isDirectory() ? files(p) : (/\.(?:js|mjs)$/.test(p) ? [p] : []);
  });
}

let failed = false;
const targets = [...files(path.join(process.cwd(), 'server')), ...files(path.join(process.cwd(), 'worker'))];
for (const file of targets) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
if (failed) process.exit(1);
