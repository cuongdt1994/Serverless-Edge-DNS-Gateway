# 🛡️ Serverless Edge DNS Gateway
[English](README.md) | [Tiếng Việt](README_VN.md)

A secure, high-performance DNS-over-HTTPS (DoH) proxy running as a standalone Cloudflare Worker with Workers Static Assets. Optimized for speed, geographic accuracy (ECS), and professional adblocking.

<p align="center">
  <img src="https://img.bibica.net/0Biaw3bp.webp" alt="ECS">
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=GRUVWBHA360">
    <img src="https://img.youtube.com/vi/GRUVWBHA360/maxresdefault.jpg" alt="Watch on YouTube">
  </a>
</p>

---

## ⚡ Key Features

*   **100% Free Usage**: Fully hosted on the Cloudflare Pages Free Tier with a limit of 100,000 requests per day. Given an average consumption of 200 – 4,000 requests per device daily, a single account can comfortably support 10 – 20 devices (or even 100 – 200 devices with casual usage).
*   **Custom Domain Scaling**: Attach your own domain for a professional, short DNS endpoint. You can spread usage across multiple Cloudflare accounts to multiply your quota (100k per account) while keeping your custom domains.
*   **Smart Adblocking**: Local filtering using professional lists (AdGuard, ABPVN, Bypass-VN, etc.), automatically updated **every hour**.
*   **ECS Geo-Optimization (RFC 7871)**: Injects EDNS Client Subnet (IPv4 `/24`, IPv6 `/48`) to ensure CDNs (Akamai, CloudFront, Fastly, BunnyCDN, Gcore) resolve you to the nearest servers.
*   **Sequential Failover Reliability**: 
    *   **Primary/Fallback**: Tries Cloudflare Gateway primary endpoint first, with automatic failover to a backup endpoint if it fails.
    *   **Geo-Bypass**: Automatically detects geo-blocked results (127.0.0.1) and re-resolves via **Quad9 DNS**.
*   **Early Response Filtering**: Drops unnecessary query types (`ANY`, `AAAA`, `PTR`, `HTTPS`) at the edge to save resources and improve speed.
*   **Private TLD Shield**: Prevents local/internal domain leaks (e.g., `.local`, `.lan`, router logins) by returning `NXDOMAIN` instantly.
*   **DNS Redirection (CNAME Injection)**: Redirects domain A to domain B using a CNAME record. This allows forcing a specific CDN chain or overriding resolution (e.g., Bilibili, TikTok, Medium).
*   **Zero-App Setup**: Native Apple `.mobileconfig` generation and a clean, responsive landing page included.

---

## 🚀 Deployment

This repository is deployed as a standalone Worker; it no longer uses the Pages Functions runtime.

```bash
npm install
npx wrangler login
npx wrangler deploy
```

To attach the custom domain during deployment (the zone and DNS record must already be available in the Cloudflare account):

```bash
npx wrangler deploy --domains dns.nexushomes.uk
```

The Worker name is fixed as `serverless-edge-dns-gateway`. Static files are deployed from `public/`, including `public/index.html` and `public/rules/`.

---

## ⚙️ Configuration (`functions/[[path]].js`)

Detailed settings are managed at the top of the [functions/[[path]].js](functions/[[path]].js#L2-L30) file.

### Resolvers & Upstreams
The parameters below are pre-configured with optimal defaults.

> [!IMPORTANT]
> Only **Cloudflare Gateway** ensures the most accurate CDN resolution for services like Akamai. You can use the default upstreams provided, or create your own [DNS locations](https://dash.cloudflare.com/?to=/:account/one/networks/resolvers-proxies) within your Cloudflare account.

| Constant | Default | Description |
| :--- | :--- | :--- |
| `UPSTREAM_PRIMARY` | Cloudflare Gateway | Main resolver URL. |
| `UPSTREAM_FALLBACK` | Cloudflare Gateway | Backup resolver. |
| `UPSTREAM_GEO_BYPASS`| `dns.quad9.net` | Used when upstream returns loopback (127.0.0.1). |

### Edge Filtering (Optimization)
| Constant | Default | Description |
| :--- | :--- | :--- |
| `BLOCK_AAAA` | `false` | Forces IPv4 routing by blocking AAAA. |
| `BLOCK_HTTPS` | `false` | Prevents Type 65 lookups (speeds up resolution). |
| `BLOCK_ANY` | `false` | Blocks resource-heavy ANY queries. |
| `BLOCK_PTR` | `false` | Blocks reverse DNS queries. |
| `BLOCK_PRIVATE_TLD` | `true` | Blocks internal/router domains. |
| `ECS_INJECTION_ENABLED` | `true` | Enables ECS Injection (Required for accurate CDN). |

---

## 🛠 Rule Management (`rules/`)

Rules are maintained in `rules/` and mirrored to `public/rules/` by `update_lists.sh`. The Worker deployment reads the public copy through the Static Assets binding. The update workflow refreshes both copies, so the next Worker deployment includes the same data.

Detailed rules:

*   **`blocklists.txt`** / **`allowlists.txt`**: Automatically updated **every hour**.
    *   **Logic**: Domains in `allowlists.txt` override `blocklists.txt`, ensuring they are never blocked even if flagged by a filter (prevents false positives).
    *   **How to configure**: Edit the URLs in the `curl` command inside [update_lists.sh](update_lists.sh#L34-L43) to add or remove filtering sources.
*   **`private_tlds.txt`**: Add your custom local domains or router URLs here.
*   **`redirect_rules.txt`**: Redirects domain A to domain B using a CNAME record. Perfect for forcing specific CDN results.
    *   **Format**: `source-domain target-domain`
    *   **Example**: `www.bilibili.tv www.bilibili.tv.w.cdngslb.com`
    *   **Effect**: If `www.bilibili.tv` randomly returns multiple CDNs (e.g., GSLB or Akamai), this rule forces it to always use `www.bilibili.tv.w.cdngslb.com`.

---

## 📱 Setup Instructions

### Browsers (Chrome / Edge / Firefox)
1.  Go to **Settings** > **Privacy and Security** > **Security**.
2.  Enable **"Use secure DNS"** and select **"Custom"**.
3.  Paste your endpoint: `https://serverless-edge-dns-gateway.<account>.workers.dev/dns-query`

### Apple (iOS / macOS)
1.  Open your project URL in **Safari**.
2.  Click **Download Apple Profile** and install via system settings.

### Android (Intra App)
1.  Open Intra > **Configure custom server URL**.
2.  Paste your `/dns-query` endpoint and toggle ON.

---

## 🔎 API & Endpoints

| Endpoint | Description |
| :--- | :--- |
| `/dns-query` | The DoH resolver endpoint. |
| `/debug` | Returns a JSON summary of config, stats, and rule counts. |
| `/apple` | Generates a native Apple `.mobileconfig` profile for iOS/macOS. |

## 🧪 Local tests

```bash
npm test
npx wrangler dev --local
```

The test suite covers RFC 8484 GET and POST requests, binary responses, transaction IDs, static assets, and the 400/405/413/415 validation paths.

## 📡 MikroTik RouterOS

On RouterOS versions that support DoH, configure the endpoint as follows and use a trusted public certificate on the custom domain:

```routeros
/ip dns set use-doh-server=https://dns.nexushomes.uk/dns-query verify-doh-cert=yes allow-remote-requests=yes
```

If the custom domain is not yet resolving, use the Worker URL temporarily:

```routeros
/ip dns set use-doh-server=https://serverless-edge-dns-gateway.<account>.workers.dev/dns-query verify-doh-cert=yes allow-remote-requests=yes
```

---
