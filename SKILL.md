---
name: anemone-browser
description: >
  Managed headful Chrome browser for OpenClaw agents with anti-bot-detection,
  human-in-the-loop VNC takeover, and multi-session window isolation.
  Use when: (1) setting up browser automation on a new machine (Mac/Linux/Docker),
  (2) browser gets blocked by Google, Cloudflare, or CAPTCHAs,
  (3) need human to intervene via VNC (login, CAPTCHA solving),
  (4) multiple agent sessions need independent browser windows without conflicts,
  (5) configuring OpenClaw's browser tool for headful Chrome.
  Triggers: "set up browser", "browser blocked", "CAPTCHA", "VNC",
  "Google Scholar blocked", "headless detected", "anti-detection",
  "browser setup", "Chrome for agent".
---

# Anemone Browser — Managed Browser for OpenClaw Agents

Headful Chrome with anti-detection, VNC takeover, and multi-session isolation.
Works on Mac, Linux, Docker — anywhere OpenClaw runs.

## Setup

### macOS

```bash
bash scripts/setup-mac.sh
```

Detects Chrome, configures OpenClaw browser profile. After setup:
```bash
openclaw browser start
# Agent's browser tool works automatically
```

> **Note:** macOS setup does NOT include VNC/noVNC. The user is expected to access
> the Mac via their own remote desktop solution (e.g. macOS Screen Sharing, Tailscale,
> or physical access). VNC takeover with noVNC links is only available on Linux.

### Linux / Docker

```bash
# Install deps (once)
bash scripts/setup.sh

# Start browser + VNC environment
bash scripts/start.sh [password] [novnc_port] [cdp_port] [resolution]
```

`start.sh` outputs the noVNC URL, password, and CDP port. Safe to re-run.

## OpenClaw Config

Setup scripts configure this automatically. Manual reference:

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

**Linux:**
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

## Multi-Session Window Isolation

Multiple sessions share one Chrome (same cookies/logins) but each gets its own window.

### Rules (MUST follow):

1. **On session start — open your own tab, save the targetId:**
   ```
   browser action=open targetUrl="https://example.com" profile=openclaw
   # Returns targetId — THIS IS YOURS, save it
   ```

2. **ALL subsequent calls — always include your targetId:**
   ```
   browser action=snapshot profile=openclaw targetId="<your-targetId>"
   browser action=navigate profile=openclaw targetId="<your-targetId>" targetUrl="..."
   browser action=act profile=openclaw targetId="<your-targetId>" ...
   ```

3. **On session end — close your tab:**
   ```
   browser action=close targetId="<your-targetId>"
   ```

4. **NEVER operate without targetId** — you'll land on another session's tab.

5. **NEVER pick another session's tab** from `browser action=tabs`.

### Opening a new window (not tab) via CDP:

```python
import json, asyncio, websockets, urllib.request

async def open_new_window(cdp_port, url):
    version = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{cdp_port}/json/version").read())
    async with websockets.connect(version["webSocketDebuggerUrl"]) as ws:
        await ws.send(json.dumps({
            "id": 1, "method": "Target.createTarget",
            "params": {"url": url, "newWindow": True}
        }))
        resp = json.loads(await ws.recv())
        return resp["result"]["targetId"]
```

### Architecture:
```
Chrome (one instance, one profile, shared cookies)
├── Window targetId=AAA → Session A
├── Window targetId=BBB → Session B
└── Window targetId=CCC → Session C
```

## VNC Takeover (CRITICAL)

When hitting a CAPTCHA, login wall, or any blocker, **send the user a noVNC link:**

```
https://<IP>:<NOVNC_PORT>/vnc.html?password=<PASSWORD>&autoconnect=true&resize=scale
```

### Constructing the link:

**Linux/Docker** (from start.sh output):
```
https://57.129.90.145:10150/vnc.html?password=e0GGP4xeMUL5ga&autoconnect=true&resize=scale
```
- IP: server's public or Tailscale IP
- Port + password: from start.sh output

**macOS:** VNC takeover is NOT available. The user must access the Mac directly
(physical access, macOS Screen Sharing, or their own remote desktop solution).

### Takeover flow:

1. Agent detects blocker (CAPTCHA, login, 2FA)
2. Agent sends noVNC link to user
3. User opens link → sees Chrome → solves the problem
4. User confirms done → agent continues

## Anti-Detection

- **Headful Chrome** — no `HeadlessChrome` in UA
- **`--disable-blink-features=AutomationControlled`** — no `navigator.webdriver=true`
- **UA override via CDP** if needed:
  ```json
  {"method": "Network.setUserAgentOverride", "params": {
    "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36"
  }}
  ```

## Security

- SSL/TLS on noVNC (self-signed cert)
- Random 14-char password (Linux) or system auth (macOS)
- CDP: localhost only, never exposed to network
- Chrome Policy: `file://`, `javascript:`, `data:text/html` blocked; extensions blocked; DevTools disabled

## Important: No Kiosk Mode

Do NOT use Chrome's `--kiosk` flag. It hides the tab bar and address bar, making multi-window unusable via VNC. Use `--start-maximized` instead.

## Troubleshooting

### Chrome window not visible in VNC

**Symptoms:** VNC connects but shows only Ubuntu splash screen, no Chrome window.

**Common causes and fixes:**

1. **Fluxbox crashed (becomes defunct):**
   - Check: `ps aux | grep fluxbox | grep defunct`
   - Fix: Restart fluxbox
     ```bash
     export DISPLAY=:99
     fluxbox &
     ```

2. **Stale X display lock files:**
   - Check: `ls -la /tmp/.X*lock`
   - Fix: Use a different display number, or remove lock if no Xvfb running
     ```bash
     rm -f /tmp/.X99-lock
     ```

3. **Chrome window minimized or hidden:**
   - Check: `xwininfo -root -tree` to find Chrome window ID
   - Fix: Use python-xlib to raise and resize:
     ```python
     from Xlib.display import Display
     d = Display(':99')
     window = d.create_resource_object('window', 0x800001)  # Chrome's window ID
     window.configure(x=0, y=0, width=1920, height=1040)
     window.configure(stack_mode='Above')
     d.sync()
     ```

4. **X11vnc not capturing properly:**
   - Restart x11vnc after fluxbox:
     ```bash
     pkill x11vnc
     x11vnc -display :99 -forever -shared -rfbauth ~/.vnc/passwd -rfbport 5900 -bg
     ```

### Complete restart procedure

If all else fails, kill and restart everything:

```bash
# Kill all
pkill -9 -u $USER chrome
pkill -9 -u $USER x11vnc
pkill -9 -u $USER Xvfb
pkill -9 -u $USER fluxbox
pkill -9 -u $USER websockify
sleep 2

# Start fresh (use new display number to avoid stale locks)
rm -f /tmp/.X30-lock
Xvfb :30 -screen 0 1920x1080x24 &
sleep 2
export DISPLAY=:30
fluxbox &
sleep 2
google-chrome-stable --no-sandbox --disable-gpu ... &
sleep 4
x11vnc -display :30 -forever -shared -rfbauth ~/.vnc/passwd -rfbport 5900 -bg
sleep 1
websockify --web=/usr/share/novnc --cert=~/.vnc/combined.pem 15005 localhost:5900 -D
```

### Auto-Recovery (healthcheck.sh)

`start.sh` automatically installs a cron job that runs `healthcheck.sh` every 2 minutes.
It monitors all 5 components and auto-restarts any that crash or become defunct:

- **Xvfb** — cleans stale lock files, restarts display
- **fluxbox** — detects defunct (zombie) state, kills and restarts
- **x11vnc** — restarts VNC server
- **websockify** — restarts noVNC proxy
- **Chrome** — restarts with same CDP port and anti-detection flags

Logs: `/tmp/anemone-healthcheck.log`

Manual run:
```bash
bash /root/healthcheck.sh [display_num] [vnc_port] [novnc_port] [cdp_port]
# defaults: 99 5900 6080 9222
```

To check status:
```bash
tail -20 /tmp/anemone-healthcheck.log
```

To disable:
```bash
crontab -l | grep -v healthcheck | crontab -
```
