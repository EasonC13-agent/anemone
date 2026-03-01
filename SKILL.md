# Docker VNC Browser Skill

Set up a headful Chrome browser with noVNC remote access inside Docker containers.
Provides both AI-driven CDP automation and human VNC intervention via web browser.

## What This Does

1. Starts **Xvfb** (virtual display) + **Fluxbox** (window manager)
2. Launches **Chrome in headful mode** with anti-detection flags
3. Runs **x11vnc** for VNC access (password protected)
4. Runs **noVNC + websockify** with SSL for secure web-based VNC
5. Chrome exposes **CDP (Chrome DevTools Protocol)** for agent automation

## Quick Start

```bash
# Copy setup script into container and run
docker cp setup-vnc-browser.sh <container>:/tmp/
docker exec <container> bash /tmp/setup-vnc-browser.sh

# Start the environment
docker exec <container> bash /root/start_vnc_browser.sh
# Or with custom password and port:
docker exec <container> bash /root/start_vnc_browser.sh mypassword 6080
```

## Access

- **Human (noVNC)**: `https://<IP>:<NOVNC_PORT>/vnc.html?password=<PASS>&autoconnect=true`
- **Agent (CDP)**: Connect to `http://127.0.0.1:<CDP_PORT>/json/version` inside container

## Scripts

### `setup-vnc-browser.sh`
One-time setup: installs Chrome, Xvfb, x11vnc, noVNC, fluxbox, websockify.
Run once per container.

### `start_vnc_browser.sh`
Starts the full environment. Arguments:
- `$1` - VNC password (default: random 14-char)
- `$2` - noVNC port (default: 6080)
- `$3` - CDP port (default: 9222)

Outputs the connection URL with password.

## Anti-Detection

Chrome is launched with:
- `--disable-blink-features=AutomationControlled` (hides `navigator.webdriver`)
- Headful mode (not headless) via Xvfb
- Persistent profile at `/root/.chrome-profile`
- Agent should use `Network.setUserAgentOverride` via CDP to remove "HeadlessChrome" from UA

## For Agent Use

When automating via CDP from the agent:
1. Get WebSocket URL: `curl http://127.0.0.1:<CDP_PORT>/json/version`
2. Override UA first: `Network.setUserAgentOverride` with a normal Chrome UA
3. Then navigate and interact normally

## Ports

| Service | Default Port | Purpose |
|---------|-------------|---------|
| noVNC (websockify+SSL) | 6080 | Human web VNC access |
| x11vnc | 5900 | Internal VNC (localhost only) |
| Chrome CDP | 9222 | Agent automation |

Make sure these ports are exposed in your Docker container's port mapping.

## Security

- x11vnc binds to localhost only (not exposed externally)
- noVNC uses self-signed SSL certificate (auto-generated)
- VNC password stored in `/root/.vnc/passwd` (encrypted)
- Password is random 14-char by default, or user-specified
