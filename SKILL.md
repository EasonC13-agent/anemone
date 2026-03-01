# Anemone — Managed Browser for OpenClaw Agents

A managed Chrome environment that works anywhere: Mac, Docker, Ubuntu, VPS.
Anti-detection, human-in-the-loop VNC (for remote/Docker), and secure by default.

## When to Use This Skill

- Setting up a browser environment for OpenClaw on a new machine
- Browser gets blocked by Google, Cloudflare, or CAPTCHA walls
- Need human intervention (login, CAPTCHA solving) via VNC on remote servers
- Need a secure, isolated browser for AI agent automation
- Configuring OpenClaw's `browser` tool to work in Docker/VPS

## Platform Setup

### macOS (local machine)

```bash
bash setup-mac.sh
```

This configures OpenClaw to use a managed `openclaw` browser profile.
No VNC needed (you have a display). After setup:

```bash
openclaw browser start
openclaw browser open https://www.google.com
```

The agent's `browser` tool will automatically use this managed Chrome.

### Docker / VPS / Remote Server (Linux)

```bash
# 1. Copy files into container
docker cp setup.sh <container>:/tmp/anemone-setup.sh
docker cp start.sh <container>:/tmp/anemone-start.sh

# 2. Install dependencies (once)
docker exec <container> bash /tmp/anemone-setup.sh

# 3. Start the browser environment
docker exec <container> bash /root/start.sh [password] [novnc_port] [cdp_port] [resolution]
```

### Ubuntu (bare metal)

```bash
bash setup.sh   # Install Chrome + VNC deps
bash start.sh   # Start everything
```

## After Setup: Agent Usage

Once set up, the agent uses the standard `browser` tool. No special commands needed.

```
# Agent just uses browser tool normally:
browser action=open targetUrl="https://scholar.google.com" profile=openclaw
browser action=snapshot profile=openclaw
```

### OpenClaw Config (what setup scripts configure)

**macOS:**
```json
{
  "browser": {
    "enabled": true,
    "defaultProfile": "openclaw",
    "headless": false,
    "executablePath": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  }
}
```

**Docker/Linux** (add to container's OpenClaw config):
```json
{
  "browser": {
    "enabled": true,
    "headless": false,
    "noSandbox": true,
    "executablePath": "/usr/bin/google-chrome-stable"
  }
}
```

## Anti-Detection

Anemone bypasses common bot detection:

- **Headful Chrome** (not headless) — no `HeadlessChrome` in navigator
- **`--disable-blink-features=AutomationControlled`** — removes `navigator.webdriver=true`
- **UA override via CDP** — clean user agent string

If Google or Scholar still blocks, override UA via CDP:
```python
# Via CDP websocket
{"method": "Network.setUserAgentOverride", "params": {
  "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
}}
```

## Human-in-the-Loop (Docker/VPS only)

When the agent hits a CAPTCHA or login wall on a remote server:

1. Agent sends you the noVNC URL
2. Open it in your browser: `https://<IP>:<PORT>/vnc.html?password=<PASS>&autoconnect=true&resize=scale`
3. Solve the CAPTCHA / complete the login
4. Agent continues automatically

## Security

| Layer | Protection |
|-------|-----------|
| Network | SSL/TLS (self-signed cert) |
| Auth | Random 14-char password (or custom) |
| CDP | Localhost only (not exposed) |
| Chrome Policy | `file://` blocked, extensions blocked, DevTools disabled |
| Isolation | Docker container / separate browser profile |

## Files

| File | Platform | Purpose |
|------|----------|---------|
| `setup-mac.sh` | macOS | Configure OpenClaw browser settings |
| `setup.sh` | Linux/Docker | Install Chrome + Xvfb + VNC + noVNC |
| `start.sh` | Linux/Docker | Start browser environment (safe to re-run) |
| `test.py` | Linux/Docker | Verify Google/Scholar access |

## Troubleshooting

**Mac: "Browser disabled"**
→ Run `openclaw browser start` or check `openclaw browser status`

**Docker: Chrome crashes**
→ Make sure `--no-sandbox` is enabled and `/dev/shm` is large enough:
```bash
docker run --shm-size=2g ...
```

**Google still blocks**
→ Check UA string. Run `test.py` to verify. Datacenter IPs may need additional measures.

**VNC won't connect**
→ Check port mapping. The noVNC port must be exposed from the container.
