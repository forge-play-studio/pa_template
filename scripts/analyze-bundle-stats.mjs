#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const args = parseArgs(process.argv.slice(2));
const buildExitCode = Number(args.buildExitCode ?? process.env.BUILD_EXIT_CODE ?? 0);
const reportDir = String(args.reportDir ?? 'bundle-stats-report');
const statsPath = String(args.statsPath ?? 'dist/stats.json');
const buildLogPath = String(args.buildLog ?? 'build.log');

fs.mkdirSync(reportDir, { recursive: true });

const repo = process.env.GITHUB_REPOSITORY ?? readPackageName();
const runUrl = getRunUrl();
const refName = process.env.GITHUB_REF_NAME ?? '';
const sha = process.env.GITHUB_SHA ?? '';
const commit = sha ? sha.slice(0, 7) : 'unknown';
const generatedAt = new Date().toISOString();

const htmlOutputs = listHtmlOutputs('dist');
const result = {
  status: buildExitCode === 0 ? 'success' : 'failure',
  generatedAt,
  repo,
  refName,
  commit,
  runUrl,
  buildExitCode,
  htmlOutputs,
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
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return pkg.name ?? 'unknown';
  } catch {
    return 'unknown';
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
    };
  });
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

  return {
    moduleCount: modules.length,
    totals,
    topModules,
    topPackages,
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
    `**Updated**: ${data.generatedAt}`,
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

  if (data.htmlOutputs.length > 0) {
    lines.push('## Final HTML Outputs', '');
    lines.push('| File | Raw | Gzip | Brotli |');
    lines.push('|---|---:|---:|---:|');
    for (const output of data.htmlOutputs) {
      lines.push(`| \`${output.file}\` | ${formatBytes(output.bytes)} | ${formatBytes(output.gzipBytes)} | ${formatBytes(output.brotliBytes)} |`);
    }
    lines.push('');
  }

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
  lines.push('Workflow artifacts include standalone attachments for the playable HTML and visual bundle report, plus the full `bundle-stats-*` report bundle.');
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

function readBuildLogTail() {
  if (!fs.existsSync(buildLogPath)) return '';
  const lines = fs.readFileSync(buildLogPath, 'utf8').split(/\r?\n/);
  return lines.slice(-80).join('\n').trim();
}
