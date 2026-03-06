#!/usr/bin/env node
// Anemone Browser CLI
// Managed headful Chrome with VNC + auto-recovery

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPTS_DIR = join(__dirname, '..', 'scripts');
const STATE_FILE = '/tmp/anemone-state.json';

// ── Helpers ──

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 30000, ...opts }).trim();
  } catch (e) {
    if (opts.ignoreError) return e.stdout?.trim() || '';
    throw e;
  }
}

function isLinux() {
  return process.platform === 'linux';
}

function isMac() {
  return process.platform === 'darwin';
}

function parseArgs(argv) {
  const args = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { args, positional };
}

// ── Commands ──

function cmdSetup() {
  if (isMac()) {
    console.log('Running macOS setup...');
    execSync(`bash ${join(SCRIPTS_DIR, 'setup-mac.sh')}`, { stdio: 'inherit' });
  } else if (isLinux()) {
    console.log('Running Linux setup...');
    execSync(`bash ${join(SCRIPTS_DIR, 'setup.sh')}`, { stdio: 'inherit' });
  } else {
    console.error('Unsupported platform:', process.platform);
    process.exit(1);
  }
}

function cmdStart(args) {
  if (isMac()) {
    console.log('macOS: Use `openclaw browser start` after running `anemone setup`.');
    console.log('Anemone start/stop/VNC is for Linux/Docker only.');
    return;
  }

  const password = args.password || '';
  const novncPort = args['novnc-port'] || args.port || '6080';
  const cdpPort = args['cdp-port'] || '9222';
  const resolution = args.resolution || '1920x1080x24';

  console.log('Starting Anemone...');
  const result = execSync(
    `bash ${join(SCRIPTS_DIR, 'start.sh')} "${password}" ${novncPort} ${cdpPort} ${resolution}`,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'], timeout: 60000 }
  );
  console.log(result);

  // Parse output for state
  const pwMatch = result.match(/Password:\s+(\S+)/);
  const portMatch = result.match(/https:\/\/<YOUR_IP>:(\d+)/);
  const cdpMatch = result.match(/CDP:\s+http:\/\/127\.0\.0\.1:(\d+)/);
  const displayMatch = run('echo $DISPLAY', { ignoreError: true }) || ':99';

  const state = {
    running: true,
    startedAt: new Date().toISOString(),
    password: pwMatch?.[1] || password,
    novncPort: portMatch?.[1] || novncPort,
    cdpPort: cdpMatch?.[1] || cdpPort,
    display: displayMatch,
  };
  saveState(state);
}

function cmdStop() {
  if (isMac()) {
    console.log('macOS: Use `openclaw browser stop`.');
    return;
  }

  console.log('Stopping all Anemone services...');
  run('pkill -9 -f "chrome" 2>/dev/null || true', { ignoreError: true });
  run('pkill -9 -f x11vnc 2>/dev/null || true', { ignoreError: true });
  run('pkill -9 -f websockify 2>/dev/null || true', { ignoreError: true });
  run('pkill -9 -f fluxbox 2>/dev/null || true', { ignoreError: true });
  run('pkill -9 -f Xvfb 2>/dev/null || true', { ignoreError: true });

  // Remove healthcheck cron
  try {
    const crontab = run('crontab -l 2>/dev/null', { ignoreError: true });
    if (crontab.includes('healthcheck')) {
      const filtered = crontab.split('\n').filter(l => !l.includes('healthcheck')).join('\n');
      execSync('crontab -', { input: filtered + '\n' });
      console.log('Healthcheck cron removed.');
    }
  } catch {}

  saveState({ running: false, stoppedAt: new Date().toISOString() });
  console.log('Stopped.');
}

function cmdStatus() {
  if (isMac()) {
    const browserRunning = run('pgrep -f "Google Chrome" > /dev/null 2>&1 && echo yes || echo no', { ignoreError: true });
    console.log(`Platform:  macOS`);
    console.log(`Chrome:    ${browserRunning === 'yes' ? '✅ running' : '❌ not running'}`);
    console.log(`\nUse \`openclaw browser start\` to manage.`);
    return;
  }

  const state = loadState();
  const checks = [
    { name: 'Xvfb',       check: () => run('pgrep -f "Xvfb" | head -1', { ignoreError: true }) },
    { name: 'fluxbox',    check: () => {
      const pid = run('pgrep -x fluxbox', { ignoreError: true });
      if (!pid) return '';
      const defunct = run('ps aux | grep fluxbox | grep defunct', { ignoreError: true });
      return defunct ? 'defunct' : pid;
    }},
    { name: 'Chrome',     check: () => run('pgrep -f "chrome.*remote-debugging" | head -1', { ignoreError: true }) },
    { name: 'x11vnc',     check: () => run('pgrep -f x11vnc | head -1', { ignoreError: true }) },
    { name: 'websockify', check: () => run('pgrep -f websockify | head -1', { ignoreError: true }) },
  ];

  console.log('Anemone Status');
  console.log('══════════════════════════════');

  let allOk = true;
  for (const { name, check } of checks) {
    const result = check();
    let icon;
    if (!result) { icon = '❌ stopped'; allOk = false; }
    else if (result === 'defunct') { icon = '⚠️  defunct (zombie)'; allOk = false; }
    else { icon = `✅ running (pid ${result})`; }
    console.log(`  ${name.padEnd(12)} ${icon}`);
  }

  // Healthcheck cron
  const crontab = run('crontab -l 2>/dev/null', { ignoreError: true });
  const hcInstalled = crontab.includes('healthcheck');
  console.log(`  ${'healthcheck'.padEnd(12)} ${hcInstalled ? '✅ cron active' : '❌ not installed'}`);

  console.log('══════════════════════════════');
  if (state.password) {
    console.log(`  Password:  ${state.password}`);
  }
  if (state.novncPort) {
    console.log(`  noVNC:     https://<IP>:${state.novncPort}/vnc.html`);
  }
  if (state.cdpPort) {
    console.log(`  CDP:       http://127.0.0.1:${state.cdpPort}/json/version`);
  }
  console.log(`  Overall:   ${allOk ? '✅ healthy' : '⚠️  needs attention'}`);

  if (!allOk) {
    console.log('\nRun `anemone healthcheck` to auto-fix, or `anemone restart` to restart all.');
  }
}

function cmdHealthcheck(args) {
  if (isMac()) {
    console.log('Healthcheck is for Linux/Docker only.');
    return;
  }

  const state = loadState();
  const displayNum = args.display || state.display?.replace(':', '') || '99';
  const vncPort = args['vnc-port'] || '5900';
  const novncPort = args['novnc-port'] || state.novncPort || '6080';
  const cdpPort = args['cdp-port'] || state.cdpPort || '9222';

  console.log('Running healthcheck...');
  execSync(
    `bash ${join(SCRIPTS_DIR, 'healthcheck.sh')} ${displayNum} ${vncPort} ${novncPort} ${cdpPort}`,
    { stdio: 'inherit', timeout: 30000 }
  );
}

function cmdUrl() {
  const state = loadState();
  if (!state.password || !state.novncPort) {
    console.log('Anemone not running or state unknown. Run `anemone start` first.');
    return;
  }

  // Try to detect public IP
  let ip = '<IP>';
  try {
    ip = run('curl -s --max-time 3 ifconfig.me', { ignoreError: true }) || '<IP>';
  } catch {}

  const url = `https://${ip}:${state.novncPort}/vnc.html?password=${state.password}&autoconnect=true&resize=scale`;
  console.log(url);
}

function cmdRestart(args) {
  cmdStop();
  console.log('');
  cmdStart(args);
}

// ── Main ──

const { args, positional } = parseArgs(process.argv.slice(2));
const command = positional[0] || 'help';

switch (command) {
  case 'setup':
    cmdSetup();
    break;
  case 'start':
    cmdStart(args);
    break;
  case 'stop':
    cmdStop();
    break;
  case 'restart':
    cmdRestart(args);
    break;
  case 'status':
    cmdStatus();
    break;
  case 'healthcheck':
  case 'hc':
    cmdHealthcheck(args);
    break;
  case 'url':
    cmdUrl();
    break;
  case 'help':
  case '--help':
  case '-h':
    console.log(`
🌊 Anemone Browser — Managed Chrome for OpenClaw agents

Usage: anemone <command> [options]

Commands:
  setup                Install dependencies (Chrome, VNC, etc.)
  start [options]      Start Chrome + VNC + healthcheck
  stop                 Stop all services
  restart [options]    Stop + start
  status               Check all components
  healthcheck (hc)     Run auto-recovery check
  url                  Print noVNC URL

Start options:
  --password <pass>    VNC password (random if omitted)
  --port <port>        noVNC port (default: 6080)
  --cdp-port <port>    Chrome CDP port (default: 9222)
  --resolution <WxHxD> Display resolution (default: 1920x1080x24)

Examples:
  anemone setup
  anemone start --password mypass --port 10150
  anemone status
  anemone url
`);
    break;
  default:
    console.error(`Unknown command: ${command}\nRun \`anemone help\` for usage.`);
    process.exit(1);
}
