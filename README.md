# 🌊 Anemone

<p align="center">
  <img src="assets/anemone-banner.png" alt="Anemone - Managed browser for OpenClaw" width="600">
</p>

<p align="center">
  <em>A managed Chrome environment for <a href="https://github.com/openclaw/openclaw">OpenClaw</a> that just works — anywhere.</em>
</p>

---

## The Problem

OpenClaw agents need a browser. But getting one that reliably works is harder than it should be:

- **Mac/Desktop** — Browser Relay extension disconnects, requires manual re-attach
- **Docker/VPS** — Headless Chrome gets blocked by Google, Cloudflare, CAPTCHA walls
- **Remote servers** — No GUI, no way for humans to intervene when things go wrong

You shouldn't have to fight your browser. You should be building agents.

## The Solution

Anemone gives OpenClaw a **managed Chrome that runs anywhere** — Mac, Docker, Ubuntu, VPS — with:

- 🐟 **Anti-detection** — Headful Chrome, clean fingerprint, no "HeadlessChrome" leaks
- 🖥️ **Remote access** — Web-based VNC (noVNC) so you can see and control the browser from anywhere
- 🤖 **Agent-native** — CDP integration, OpenClaw controls Chrome directly
- 🔒 **Secure** — SSL, password auth, Chrome Policy locks down file access and extensions
- 🔄 **Persistent** — Cookies and login sessions survive restarts
- 👤 **Human-in-the-loop** — When CAPTCHA hits, open VNC in your browser and solve it. Done.

No more relay disconnects. No more blocked searches. No more blind headless Chrome.

## Quick Start

### Install via npm

```bash
npm install -g anemone-browser
```

### Linux / Docker / VPS

```bash
# 1. Install dependencies (once)
anemone setup

# 2. Start everything (Chrome + VNC + auto-recovery)
anemone start --password mypass --port 6080

# 3. Check status
anemone status

# 4. Get noVNC URL to share
anemone url
```

### macOS

```bash
anemone setup    # Configures OpenClaw to use managed Chrome
# Then use: openclaw browser start
```

No VNC needed on Mac (you have a display).

### Without npm (bash scripts)

```bash
bash scripts/setup.sh
bash scripts/start.sh [password] [novnc_port] [cdp_port] [resolution]
```

## How It Works

```
 You (any browser, anywhere)           OpenClaw Agent
      │                                      │
      │ HTTPS + password                     │ CDP (localhost)
      ▼                                      ▼
 ┌──────────────────────────────────────────────────┐
 │                   Anemone                        │
 │                                                  │
 │   noVNC ──► x11vnc ──► Xvfb (virtual display)   │
 │                              │                   │
 │                     Chrome (headful, real)        │
 │                        CDP :9222                  │
 │                              │                   │
 │                  ~/.chrome-profile                │
 │                (persistent cookies)               │
 └──────────────────────────────────────────────────┘
```

**Human-in-the-loop flow:**
1. Agent browses normally via CDP
2. Hits a CAPTCHA or login wall
3. Agent sends you the VNC link
4. You open it in your browser, solve the CAPTCHA
5. Agent continues automatically

## Configuration

```bash
bash start.sh [password] [novnc_port] [cdp_port] [resolution]

# Random password (default):
bash start.sh

# Fixed password:
bash start.sh "my-secure-password"

# Custom ports + resolution:
bash start.sh "my-password" 6080 9222 1920x1080x24
```

## OpenClaw Integration

Add to your OpenClaw config (`~/.openclaw/openclaw.json`):

```json
{
  "browser": {
    "headless": false,
    "noSandbox": true,
    "executablePath": "/usr/bin/google-chrome-stable"
  }
}
```

Then use `browser` tool normally. No relay needed.

## Security

| Layer | Protection |
|-------|-----------|
| Network | SSL/TLS encryption (self-signed cert) |
| Auth | Random 14-char password (or custom) |
| CDP | Localhost only — not exposed to network |
| Chrome Policy | `file://` blocked, extensions blocked, DevTools disabled, `data:text/html` blocked |
| Isolation | Docker container separation from host |

## Tested

| Environment | IP Type | Google | Scholar | Cloudflare |
|-------------|---------|:------:|:-------:|:----------:|
| Docker (home server, Taiwan) | Residential | ✅ | ✅ | ✅ |
| Docker (OVH, France) | Datacenter | ✅ | ✅ | ✅ |

## CLI Reference

```
anemone setup              # Install deps (Chrome, Xvfb, VNC)
anemone start [options]    # Start Chrome + VNC + healthcheck cron
anemone stop               # Stop all services
anemone restart [options]  # Stop + start
anemone status             # Check all components
anemone healthcheck        # Run auto-recovery manually
anemone url                # Print noVNC URL

Options:
  --password <pass>        VNC password (random if omitted)
  --port <port>            noVNC port (default: 6080)
  --cdp-port <port>        CDP port (default: 9222)
  --resolution <WxHxD>     Display (default: 1920x1080x24)
```

## Files

| File | Purpose |
|------|---------|
| `bin/anemone.mjs` | CLI entry point |
| `scripts/setup.sh` | Linux dependency installer |
| `scripts/setup-mac.sh` | macOS setup |
| `scripts/start.sh` | Start all services |
| `scripts/healthcheck.sh` | Auto-recovery monitor |
| `scripts/test.py` | Google/Scholar access test |

## Why "Anemone"?

Sea anemones and crabs are natural symbionts — the anemone protects the crab, the crab carries the anemone. Just like Anemone protects OpenClaw's browser from detection. And yes, it sounds a bit like "anonymous" 🌊

## License

MIT

---

<p align="center">
  Part of the <a href="https://github.com/openclaw/openclaw">OpenClaw</a> ecosystem 🦀
</p>
