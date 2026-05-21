#!/usr/bin/env node
/**
 * build.js — Compiles TypeScript and packages the clientsuccess-mcp server
 * into a distributable .mcpb file.
 *
 * Automatically increments the patch version (x.y.Z) on every build and
 * writes the new version back to:
 *   - manifest.json
 *   - package.json
 *   - src/index.ts (McpServer version string)
 *
 * The .mcpb file is a self-contained ZIP:
 *   - manifest.json + icon.png (if present)
 *   - dist/ compiled JS files
 *   - node_modules/ (runtime dependencies only: @modelcontextprotocol/sdk, zod)
 *
 * Usage:
 *   npm run build:mcpb   — compile + package
 *   node build.js        — directly (assumes tsc already ran)
 */

const { execSync } = require('child_process');
const archiver = require('archiver');
const fs  = require('fs');
const path = require('path');

// ── Compile TypeScript ────────────────────────────────────────────────────────

console.log('Compiling TypeScript...');
try {
  execSync('npx tsc', { stdio: 'inherit', cwd: __dirname });
} catch (e) {
  console.error('TypeScript compilation failed.');
  process.exit(1);
}

// ── Version bump ──────────────────────────────────────────────────────────────

const MANIFEST_PATH = path.join(__dirname, 'manifest.json');
const PKG_PATH      = path.join(__dirname, 'package.json');
const INDEX_PATH    = path.join(__dirname, 'src', 'index.ts');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

const [major, minor, patch] = manifest.version.split('.').map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;
const oldVersion = manifest.version;

console.log(`Bumping version ${oldVersion} → ${newVersion}`);

manifest.version = newVersion;
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
pkg.version = newVersion;
fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');

let indexSrc = fs.readFileSync(INDEX_PATH, 'utf8');
indexSrc = indexSrc.replace(
  /(version:\s*['"])[^'"]+(['"])/,
  `$1${newVersion}$2`
);
fs.writeFileSync(INDEX_PATH, indexSrc);

// Recompile with updated version
execSync('npx tsc', { stdio: 'inherit', cwd: __dirname });

// ── Build .mcpb ───────────────────────────────────────────────────────────────

const outName = `clientsuccess-mcp-${newVersion}.mcpb`;
const outPath = path.join(__dirname, outName);

if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

// Remove previous version's mcpb
const prevName = `clientsuccess-mcp-${oldVersion}.mcpb`;
const prevPath = path.join(__dirname, prevName);
if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);

console.log(`Building ${outName}...`);

function shouldInclude(entryPath) {
  if (entryPath.endsWith('.map')) return false;
  if (entryPath.endsWith('.ts') && !entryPath.endsWith('.d.ts')) return false;
  return true;
}

const output  = fs.createWriteStream(outPath);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.on('error', err => { throw err; });
archive.pipe(output);

// Root files
archive.file('manifest.json', { name: 'manifest.json' });
if (fs.existsSync(path.join(__dirname, 'icon.png'))) {
  archive.file('icon.png', { name: 'icon.png' });
}

// Compiled dist/ directory
archive.glob('**/*', {
  cwd: path.join(__dirname, 'dist'),
}, { prefix: 'dist' });

// Runtime node_modules (only the dependencies, not devDependencies)
const nmRoot = path.join(__dirname, 'node_modules');
const runtimeDeps = Object.keys(pkg.dependencies || {});

function addPackage(pkgName) {
  const pkgDir = path.join(nmRoot, pkgName);
  if (!fs.existsSync(pkgDir)) return;
  addDir(pkgDir, pkgName);
}

function addDir(dir, relBase) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(nmRoot, abs);
    if (entry.isDirectory()) {
      // Skip nested node_modules to avoid bloat — they're hoisted
      if (entry.name === 'node_modules') continue;
      addDir(abs, relBase);
    } else if (entry.isFile() && shouldInclude(rel)) {
      archive.file(abs, { name: path.join('node_modules', rel) });
    }
  }
}

console.log('Adding node_modules (runtime deps only)...');

// Add runtime deps and their transitive deps
// Walk the full node_modules but only include what's actually needed
function getAllDirs(dir) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (entry.name.startsWith('@')) {
      // Scoped package
      const scopeDir = path.join(dir, entry.name);
      for (const sub of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        if (sub.isDirectory()) entries.push(`${entry.name}/${sub.name}`);
      }
    } else {
      entries.push(entry.name);
    }
  }
  return entries;
}

// Include all packages in node_modules — they're all runtime transitive deps
// (devDependencies like typescript and archiver are not in production installs,
//  but since we have a flat install, include the runtime tree only)
const allPkgs = getAllDirs(nmRoot);
for (const pkgName of allPkgs) {
  // Skip devDependencies we know aren't needed at runtime
  if (['archiver', 'typescript', '@types'].some(d => pkgName.startsWith(d))) continue;
  addPackage(pkgName);
}

archive.finalize();

output.on('close', () => {
  const mb = (archive.pointer() / 1024 / 1024).toFixed(1);
  console.log(`Done: ${outName} (${mb} MB)`);
});
