# Member subdomains

Namecheap BasicDNS needs one A record with host `*` and the public IPv4 of the Caddy server. The Desk Commander deployment identifies that server as `143.244.168.180`. The apex can use the same gateway to redirect old member bookmarks, with GitHub Pages serving the homepage and static assets. Explicit service names such as `www` or `retropage` take precedence over the wildcard and need their own intended DNS and HTTPS configuration.

Run the gateway under Node 22 or later. Install the files and locked dependencies in `/opt/yestersites-members` with `npm ci --omit=dev` and install the provided systemd unit, adjusting the absolute Node path to the installed version. The process binds only to loopback port 8137. Check for a port collision first.

Merge the Caddy example with the active configuration. Inspect existing catch-all handlers and any global on-demand TLS policy before merging. Validate the merged configuration with `caddy validate`, then reload. The certificate permission endpoint approves registered published member sites, including unlisted ones. It denies unknown and infrastructure names. Caddy uses its normal certificate storage and renewal. A large launch may warrant one DNS-validated wildcard certificate to avoid individual certificate issuance limits.

Check both sample and freshly published sites, a child page, an image, the BBS text edition, and a guestbook post. The publisher checks the HTTPS marker on two existing samples before switching public links. The gateway strips cookies and authorization. Sample content and published pages keep their original storage backends.

## Historical member addresses

The apex.Caddyfile serves GitHub Pages through its upstream hostname and returns HTTP 301 for member addresses, preserving the child path and query. Stage the apex certificate and validate the Caddy configuration before moving the apex A record. Keep the explicit retropage and www records. Serve HTTP-01 challenge files from /var/www/yestersites-acme and use the certificate deploy hook to install the renewed certificate and reload Caddy. Verify a historical deep link using a client with JavaScript disabled alongside the homepage, editor and a static download.
