# RODDY ID

[The account desk](https://accounts.roddy.world/) provides email and password sign-in and buddy invitations for RODDY apps. Both people must confirm a friendship before it appears in connected products. Each app keeps its own projects, preferences and session.

## Connecting another app

Register the client in `deploy/register-clients.py` with its exact HTTPS callback and required scopes. Browser-only clients also need their origin registered for the discovery and user-info requests in `people/cors.py`. Use OpenID Connect authorization code with PKCE (S256), state and nonce. Discover the endpoints and signing keys through [issuer metadata](https://accounts.roddy.world/.well-known/openid-configuration).

Use the verified issuer and permanent `sub` as the account key. The `profile` scope supplies the handle in `preferred_username`. Apps with permission to read `buddies` receive confirmed contacts as an array of objects containing `sub` and `handle` at the user-info endpoint. Refresh that list before delivering a private message. Each app can store its own data keyed by the subject.

## Founder index

[The project index](https://index.roddy.world/) uses a separate client and checks the founder subject on every request. Its links live in the account database. The founder can add and remove them after signing in.

## Deployment

The service uses systemd, Caddy, and an SQLite database under `/var/lib/roddy-id`. Back up that directory privately, including the signing key and founder ID. The install script applies migrations and registers clients. Configure the SMTP variables in the service environment to enable email verification and reset delivery.
