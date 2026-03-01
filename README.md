# docker-vnc-browser

Headful Chrome + noVNC for Docker containers. Gives AI agents a real browser with human intervention capability.

## Why

Headless Chrome in Docker gets blocked by Google, Cloudflare, etc. This skill:
- Runs Chrome in **headful mode** (via Xvfb) to avoid bot detection
- Provides **noVNC** (web-based VNC) so humans can intervene (login, solve CAPTCHA)
- Exposes **CDP** for AI agent automation
- Uses **SSL + password** for secure remote access
- **Persistent Chrome profile** keeps cookies/sessions across restarts

## Setup

```bash
# 1. Copy files into your container
docker cp setup-vnc-browser.sh <container>:/tmp/
docker cp start_vnc_browser.sh <container>:/tmp/
docker exec <container> bash /tmp/setup-vnc-browser.sh

# 2. Start environment
docker exec <container> bash /root/start_vnc_browser.sh
# Output: URL with auto-generated password

# 3. Custom password & ports
docker exec <container> bash /root/start_vnc_browser.sh "mypassword" 6080 9222
```

## Access

**Human (web browser):**
```
https://<IP>:<PORT>/vnc.html?password=<PASS>&autoconnect=true
```
Self-signed cert warning is expected; click through it.

**AI agent (CDP):**
```python
# Inside container
import urllib.request, json
version = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/version").read())
# Use websockets to connect to webSocketDebuggerUrl
```

## Testing

```bash
docker exec <container> python3 /root/test_browser.py 9222
```

Tests Google Search and Google Scholar access.

## Port Mapping

Make sure your container exposes the needed ports:
```bash
docker run -p 6080:6080 -p 9222:9222 ...
```

## Files

| File | Purpose |
|------|---------|
| `setup-vnc-browser.sh` | One-time install (Chrome, Xvfb, x11vnc, noVNC) |
| `start_vnc_browser.sh` | Start environment (idempotent, kills old processes) |
| `test_browser.py` | Test Google/Scholar access via CDP |
| `SKILL.md` | Agent instructions |

## Security

- Random 14-char password by default
- SSL via self-signed certificate (works with IP, no domain needed)
- x11vnc only listens on localhost
- External access only through websockify SSL proxy
