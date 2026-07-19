#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const args = parseArgs(process.argv.slice(2));
const buildExitCode = Number(args.buildExitCode ?? process.env.BUILD_EXIT_CODE ?? 0);
const reportDir = String(args.reportDir ?? 'bundle-stats-report');
const statsPath = String(args.statsPath ?? 'dist/stats.json');
const buildLogPath = String(args.buildLog ?? 'build.log');
const bundleLimitBytes = 5 * 1024 * 1024;

const artAssetExtensions = new Set([
  '.avif',
  '.basis',
  '.bmp',
  '.exr',
  '.fbx',
  '.gif',
  '.glb',
  '.gltf',
  '.hdr',
  '.jpeg',
  '.jpg',
  '.ktx',
  '.ktx2',
  '.mtl',
  '.obj',
  '.png',
  '.svg',
  '.tga',
  '.webp',
]);
const ignoredArtPathParts = new Set(['placeholders']);

fs.mkdirSync(reportDir, { recursive: true });

const repo = process.env.GITHUB_REPOSITORY ?? readPackageName();
const runUrl = getRunUrl();
const refName = process.env.GITHUB_REF_NAME ?? '';
const sha = process.env.GITHUB_SHA ?? '';
const commit = sha ? sha.slice(0, 7) : 'unknown';
const generatedAt = formatBeijingTime(new Date());
const packageConfig = readPackageConfig();
const representative = {
  locale: 'EN',
  tracking: true,
  channel: packageConfig?.appConfig?.analytics?.adNetwork ?? 'applovin',
  statsHtmlFile: 'dist/stats.html',
  statsFile: normalizePath(statsPath),
};

const htmlOutputs = listHtmlOutputs('dist');
const artAssets = analyzeArtAssets(['src/assets', 'public']);
const result = {
  status: buildExitCode === 0 ? 'success' : 'failure',
  generatedAt,
  repo,
  refName,
  commit,
  runUrl,
  buildExitCode,
  bundleLimitBytes,
  representative,
  htmlOutputs,
  artAssets,
  stats: null,
  error: null,
};

if (buildExitCode !== 0) {
  result.error = `Build failed with exit code ${buildExitCode}.`;
} else if (!fs.existsSync(statsPath)) {
  result.status = 'failure';
  result.error = `${statsPath} was not generated.`;
} else {
  try {
    result.stats = analyzeStats(statsPath);
  } catch (error) {
    result.status = 'failure';
    result.error = `Failed to analyze ${statsPath}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

fs.writeFileSync(path.join(reportDir, 'summary.json'), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(reportDir, 'issue.md'), buildIssueBody(result));

if (result.status !== 'success') {
  console.error(result.error);
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = rawArgs[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function readPackageName() {
  return readPackageConfig()?.name ?? 'unknown';
}

function readPackageConfig() {
  try {
    return JSON.parse(fs.readFileSync('package.json', 'utf8'));
  } catch {
    return null;
  }
}

function getRunUrl() {
  const server = process.env.GITHUB_SERVER_URL;
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!server || !repository || !runId) return '';
  return `${server}/${repository}/actions/runs/${runId}`;
}

function listHtmlOutputs(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = walk(dir)
    .filter((file) => file.endsWith('.html'))
    .filter((file) => normalizePath(file) !== 'dist/stats.html')
    .sort();
  return files.map((file) => {
    const data = fs.readFileSync(file);
    return {
      file: normalizePath(file),
      bytes: data.length,
      gzipBytes: gzipSync(data).length,
      brotliBytes: brotliCompressSync(data).length,
      overLimit: data.length > bundleLimitBytes,
    };
  });
}

function analyzeArtAssets(roots) {
  const files = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root)) {
      const normalized = normalizePath(file);
      const parts = normalized.split('/');
      if (parts.some((part) => ignoredArtPathParts.has(part))) continue;
      const ext = path.extname(file).toLowerCase();
      if (!artAssetExtensions.has(ext)) continue;
      const stat = fs.statSync(file);
      files.push({
        file: normalized,
        bytes: stat.size,
      });
    }
  }

  files.sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file));
  return {
    roots,
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
    topFiles: files.slice(0, 20),
  };
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function analyzeStats(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const modules = Object.values(data.nodeParts ?? {}).map((part) => {
    const meta = data.nodeMetas?.[part.metaUid] ?? {};
    return {
      id: trimModuleId(meta.id ?? part.metaUid),
      renderedLength: Number(part.renderedLength ?? 0),
      gzipLength: Number(part.gzipLength ?? 0),
      brotliLength: Number(part.brotliLength ?? 0),
    };
  });

  const totals = sumSizes(modules);
  const topModules = modules
    .slice()
    .sort((a, b) => b.renderedLength - a.renderedLength)
    .slice(0, 20);
  const topPackages = aggregatePackages(modules).slice(0, 15);
  const usedArtAssets = aggregateUsedArtAssets(modules);

  return {
    moduleCount: modules.length,
    totals,
    topModules,
    topPackages,
    usedArtAssets,
  };
}

function trimModuleId(id) {
  const normalized = normalizePath(id);
  const cwd = normalizePath(process.cwd());
  const relative = normalized.startsWith(`${cwd}/`) ? normalized.slice(cwd.length + 1) : normalized;
  const marker = '/node_modules/';
  if (relative.includes(marker)) {
    return `node_modules/${relative.slice(relative.lastIndexOf(marker) + marker.length)}`;
  }
  if (relative.startsWith('/node_modules/')) {
    return `node_modules/${relative.slice('/node_modules/'.length)}`;
  }
  return relative;
}

function normalizePath(value) {
  return String(value).replace(/\\/g, '/');
}

function sumSizes(items) {
  return items.reduce(
    (acc, item) => {
      acc.renderedLength += item.renderedLength;
      acc.gzipLength += item.gzipLength;
      acc.brotliLength += item.brotliLength;
      return acc;
    },
    { renderedLength: 0, gzipLength: 0, brotliLength: 0 },
  );
}

function aggregatePackages(modules) {
  const byPackage = new Map();
  for (const mod of modules) {
    const name = getPackageGroup(mod.id);
    if (!name) continue;
    const current = byPackage.get(name) ?? {
      name,
      renderedLength: 0,
      gzipLength: 0,
      brotliLength: 0,
    };
    current.renderedLength += mod.renderedLength;
    current.gzipLength += mod.gzipLength;
    current.brotliLength += mod.brotliLength;
    byPackage.set(name, current);
  }
  return [...byPackage.values()].sort((a, b) => b.renderedLength - a.renderedLength);
}

function aggregateUsedArtAssets(modules) {
  const byAsset = new Map();
  for (const mod of modules) {
    if (!isArtAssetModuleId(mod.id)) continue;
    const current = byAsset.get(mod.id) ?? {
      id: mod.id,
      renderedLength: 0,
      gzipLength: 0,
      brotliLength: 0,
    };
    current.renderedLength += mod.renderedLength;
    current.gzipLength += mod.gzipLength;
    current.brotliLength += mod.brotliLength;
    byAsset.set(mod.id, current);
  }

  const topAssets = [...byAsset.values()].sort((a, b) => b.renderedLength - a.renderedLength);
  return {
    fileCount: topAssets.length,
    totals: sumSizes(topAssets),
    topAssets: topAssets.slice(0, 20),
  };
}

function isArtAssetModuleId(id) {
  const withoutQuery = normalizePath(id).split('?')[0].split('#')[0];
  const parts = withoutQuery.split('/');
  if (parts.some((part) => ignoredArtPathParts.has(part))) return false;
  const ext = path.extname(withoutQuery).toLowerCase();
  return artAssetExtensions.has(ext);
}

function getPackageGroup(id) {
  const marker = 'node_modules/';
  if (!id.includes(marker)) {
    if (id.startsWith('src/')) return 'src';
    return '(project/other)';
  }

  const after = id.slice(id.lastIndexOf(marker) + marker.length);
  const parts = after.split('/');
  if (parts[0]?.startsWith('@')) return `${parts[0]}/${parts[1] ?? ''}`;
  return parts[0] || '(unknown package)';
}

function buildIssueBody(data) {
  const statusIcon = data.status === 'success' ? 'OK' : 'FAIL';
  const lines = [
    '# Bundle Stats Daily Report',
    '',
    `**Status**: ${statusIcon}`,
    `**Updated (Beijing)**: ${data.generatedAt}`,
    `**Repository**: ${data.repo}`,
    `**Ref**: ${data.refName || 'unknown'}`,
    `**Commit**: \`${data.commit}\``,
  ];

  if (data.runUrl) {
    lines.push(`**Workflow run**: ${data.runUrl}`);
  }

  lines.push('');

  if (data.error) {
    lines.push('## Build Failure', '', data.error, '');
    const tail = readBuildLogTail();
    if (tail) {
      lines.push('```text', tail, '```', '');
    }
    return lines.join('\n');
  }

  lines.push('## Delivery HTML Sizes', '');
  lines.push(`Limit: ${formatBytes(data.bundleLimitBytes)} (${data.bundleLimitBytes} bytes).`);
  lines.push('');
  if (data.htmlOutputs.length > 0) {
    lines.push('| File | Raw | Over 5 MiB |');
    lines.push('|---|---:|:---:|');
    for (const output of data.htmlOutputs) {
      lines.push(`| \`${output.file}\` | ${formatBytes(output.bytes)} | ${output.overLimit ? 'YES' : 'NO'} |`);
    }
  } else {
    lines.push('No delivery HTML files were found under `dist`.');
  }
  lines.push('');

  lines.push('## Representative Rollup Stats', '');
  lines.push(`Detailed module analysis uses ${data.representative.locale} / tracked / ${data.representative.channel}: \`${data.representative.statsFile}\`.`);
  lines.push('');

  lines.push('## Art Assets', '');
  const artAssets = data.artAssets;
  const usedArtAssets = data.stats?.usedArtAssets;
  lines.push('### Used In Bundle', '');
  if (!usedArtAssets || usedArtAssets.fileCount === 0) {
    lines.push('No art asset modules found in the bundle.');
  } else {
    lines.push(`Total rendered size: ${formatBytes(usedArtAssets.totals.renderedLength)} across ${usedArtAssets.fileCount} files.`);
    lines.push('');
    appendSizeTable(lines, usedArtAssets.topAssets, 'id');
  }
  lines.push('');

  lines.push('### Source Art Assets', '');
  if (!artAssets || artAssets.fileCount === 0) {
    lines.push('No art assets found under `src/assets` or `public`.');
  } else {
    lines.push(`Total raw size: ${formatBytes(artAssets.totalBytes)} across ${artAssets.fileCount} files.`);
    lines.push('');
    lines.push('| File | Raw |');
    lines.push('|---|---:|');
    for (const asset of artAssets.topFiles) {
      lines.push(`| \`${asset.file}\` | ${formatBytes(asset.bytes)} |`);
    }
  }
  lines.push('');

  const stats = data.stats;
  if (stats) {
    lines.push('## Rollup Module Totals', '');
    lines.push('| Modules | Rendered | Gzip | Brotli |');
    lines.push('|---:|---:|---:|---:|');
    lines.push(`| ${stats.moduleCount} | ${formatBytes(stats.totals.renderedLength)} | ${formatBytes(stats.totals.gzipLength)} | ${formatBytes(stats.totals.brotliLength)} |`);
    lines.push('');

    lines.push('## Top Packages', '');
    appendSizeTable(lines, stats.topPackages, 'name');

    lines.push('## Top Modules', '');
    appendSizeTable(lines, stats.topModules, 'id');
  }

  lines.push('---');
  lines.push('Workflow artifacts include all delivery HTML files, the EN tracked representative `dist/stats.html` / `dist/stats.json`, and the full `bundle-stats-*` report bundle.');
  return lines.join('\n');
}

function appendSizeTable(lines, rows, nameKey) {
  if (rows.length === 0) {
    lines.push('No rows.', '');
    return;
  }

  lines.push('| Name | Rendered | Gzip | Brotli |');
  lines.push('|---|---:|---:|---:|');
  for (const row of rows) {
    lines.push(`| \`${row[nameKey]}\` | ${formatBytes(row.renderedLength)} | ${formatBytes(row.gzipLength)} | ${formatBytes(row.brotliLength)} |`);
  }
  lines.push('');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  return `${(kib / 1024).toFixed(2)} MiB`;
}

function formatBeijingTime(date) {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return beijing.toISOString().replace('T', ' ').slice(0, 19);
}

function readBuildLogTail() {
  if (!fs.existsSync(buildLogPath)) return '';
  const lines = fs.readFileSync(buildLogPath, 'utf8').split(/\r?\n/);
  return lines.slice(-80).join('\n').trim();
}
