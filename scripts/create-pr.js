#!/usr/bin/env node
import { Octokit } from '@octokit/rest';
import fs from 'fs';

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.error('Missing GITHUB_TOKEN or GH_TOKEN in environment.');
    console.error('Set it and re-run: export GITHUB_TOKEN=...');
    process.exit(1);
  }

  const repoUrl = (await run('git', ['config', '--get', 'remote.origin.url'])).trim();
  const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?/i);
  if (!match) {
    console.error('Could not parse origin remote URL:', repoUrl);
    process.exit(1);
  }
  const owner = match[1];
  const repo = match[2];

  const head = (await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  const base = 'main';

  // Ensure branch is pushed
  try {
    await run('git', ['ls-remote', '--exit-code', '--heads', 'origin', head]);
  } catch {
    console.error(`Branch '${head}' not found on remote. Push it first:`);
    console.error(`  git push -u origin ${head}`);
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });

  // Read PR body from docs file if present
  let body = '# Security: Code scanning and dependency hardening\n';
  const prDocPath = 'docs/PR_CODE_SCANNING_FIXES.md';
  if (fs.existsSync(prDocPath)) {
    body = fs.readFileSync(prDocPath, 'utf8');
  }

  const title = 'Security: code scanning fixes, CORS hardening, secure static routes, ESLint v9 flat config';

  // Check if PR already exists
  const existing = await octokit.pulls.list({ owner, repo, state: 'open', head: `${owner}:${head}` });
  if (existing.data.length > 0) {
    console.log(`Open PR already exists: ${existing.data[0].html_url}`);
    return;
  }

  const pr = await octokit.pulls.create({ owner, repo, title, head, base, body });
  console.log('PR created:', pr.data.html_url);
}

async function run(cmd, args) {
  return await new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d.toString()));
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(err || `Command failed: ${cmd} ${args.join(' ')}`));
    });
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

