# Anemone — Safe Browser for AI Agents

Headful Chrome + noVNC + anti-detection + security hardening for Docker containers.

## When to Use

- Browser inside Docker/Linux container is getting blocked by Google, Cloudflare, etc.
- Need human intervention capability (login, CAPTCHA solving) via VNC
- Need a secure browser sandbox for AI agent automation

## Setup (One-Time)

```bash
docker cp setup.sh <container>:/tmp/
docker cp start.sh <container>:/tmp/
docker exec <container> bash /tmp/setup.sh
```

## Start

```bash
bash /root/start.sh [password] [novnc_port] [cdp_port] [resolution]
```

## Human Access (noVNC)

```
https://<IP>:<PORT>/vnc.html?password=<PASS>&autoconnect=true&resize=scale
```

## Agent Access (CDP)

CDP is localhost-only inside the container. Override UA before visiting Google:

```python
# Via CDP websocket
{"method": "Network.setUserAgentOverride", "params": {
  "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.116 Safari/537.36"
}}
```

## OpenClaw Config

```json
{
  "browser": {
    "headless": false,
    "noSandbox": true,
    "executablePath": "/usr/bin/google-chrome-stable"
  }
}
```

## Security

- Chrome Policy: blocks `file://`, `javascript:`, `data:text/html`, extensions, DevTools
- noVNC: SSL + random 14-char password
- CDP: localhost only
- Container: Docker isolation
