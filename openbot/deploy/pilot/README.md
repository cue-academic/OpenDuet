# Cue student pilot

One Ubuntu DigitalOcean Droplet (4 vCPU / 8 GB), Docker Compose, managed CopilotKit
Intelligence and OpenAI. This directory is a deployment kit, not a deployment:
nothing is provisioned or published by adding these files.

## Before exposing it

- Use school-approved regions and data-processing terms for DigitalOcean, Google,
  OpenAI and CopilotKit. Set model budgets and Intelligence usage alerts.
- Create a managed Intelligence project and obtain its server-side project API key.
  Do not use the local stand-in for students: its thread/socket authorization is
  not a multi-user security boundary.
- Create Google OAuth web credentials. Register
  `https://<CUE_DOMAIN>/api/auth/callback/google`. Prefer an Internal Workspace OAuth
  application; otherwise configure Google's consent/test-user requirements. Students
  sign in with Google; accounts are created on first sign-in. Configure the exact
  school domain and at least one administrator. Domain admission is not a 30-person
  roster: other accounts in that domain can sign in too.
- This kit disables the bundled computer with `EMBEDDED_COMPUTER=off` and clears
  all three computer-provider addresses. Both are necessary: the image otherwise
  supplies `AGENT_COMPUTER_URL` itself. No supervisor, Docker socket, privileged
  container, remote harness or student-accessible browser/shell is configured.
  `/workspace` and `/profiles` remain persistent for future use, but enabling a
  computer later requires a separate isolation review.

## Provision and configure

1. Create the Ubuntu Droplet with an SSH key. Install Docker Engine and the Compose
   plugin using Docker's Ubuntu instructions: <https://docs.docker.com/engine/install/ubuntu/>.
   Use a current Compose (2.24.4+ if using the local test override). Keep Ubuntu and
   Docker patched. Docker group membership is effectively root access.
2. Configure a DigitalOcean Cloud Firewall: inbound TCP 80/443 from the internet,
   optional UDP 443 for HTTP/3, and SSH only from administrator IPs. Do not admit
   3001, 4100 or 5432. Docker-published ports can bypass UFW; use the cloud firewall.
   Permit outbound HTTPS/DNS and managed Intelligence WebSockets.
3. Point the domain's DNS A record at the Droplet. Add AAAA only if IPv6 routing and
   firewall rules are configured. Caddy needs public DNS and ports 80/443 for ACME.
4. Clone this branch/release, then work from `openbot/deploy/pilot`:

   ```sh
   cp .env.example .env
   chmod 600 .env
   ./generate-secrets.sh
   ```

   Paste the four generated values into `.env` using a private terminal/editor;
   fill all required settings. The generator prints secrets and never edits files.
   Keep the encryption key stable and back it up securely: losing it makes stored
   credentials unreadable. Changing `POSTGRES_PASSWORD` in `.env` does not rotate
   an existing cluster's password; coordinate database role changes separately.
   Use a URL-safe password (hexadecimal generator output is safe).

   `.env` is ignored by Git. Do not save rendered `docker compose config` output:
   it contains secrets. For process-only OpenAI credentials, leave the file's key
   empty and export `OPENAI_API_KEY` in the shell used for every Compose command.
   Docker administrators can inspect container environments either way.
5. Select models available to your OpenAI project. Set a stable `DEPLOYMENT_ID`.
   Production safety switches, public URLs and the private database URL are fixed
   in `compose.yaml`; changing a similarly named `.env` variable does not override them.

## Build and start

```sh
docker compose config --quiet
docker compose build app
docker compose up -d
docker compose ps -a
docker compose logs migrate
curl --fail https://<CUE_DOMAIN>/health
```

The build context is `openbot/` and uses its Dockerfile. Alternatively set
`CUE_APP_IMAGE` to a trusted immutable registry reference, run `docker compose pull
app migrate routines attachment-cleanup`, then `docker compose up -d --no-build`.
All application services must use the same image. Record the image digest and Git
commit before every release; do not overwrite your only rollback image.

Postgres has no published port and is on an internal data network. On a fresh
cluster, the `cue` database/user are initialized, then the one-shot `migrate`
service runs `bun scripts/migrate.ts` from `/app/server`, overriding s6's entrypoint.
The app starts only after a successful migration; Caddy and routines wait for app
health. `/health` is liveness, not an OAuth/OpenAI/Intelligence readiness check.
Perform a real Google sign-in and chat smoke test before admitting students.

The pgvector image supplies the extension files needed by the migration chain.
Migration 0000 creates `vector`; migration 0010 drops the obsolete document index
and extension. Do not share this database with another application.

Caddy terminates HTTPS, renews certificates, and proxies HTTP and WebSocket upgrades
without a short stream timeout. Only Caddy publishes ports. Its certificate state,
Postgres, workspace and profiles use named volumes; `docker compose down` keeps them.
Embedded PostgreSQL is off. No local Intelligence service is in production Compose.

The two scheduled services run bounded, non-overlapping command loops:

- `bun scripts/cull-staged-attachments.ts 24`: immediately, then hourly. Reclaims
  unsent uploads older than 24 hours. Needs only the database URL.
- `bun scripts/fire-routines.ts`: immediately, then every five minutes. Needs the
  app's configuration plus `WORKER_SHARED_SECRET` and `SERVER_INTERNAL_URL`.

Failures go to container logs and retry at the next interval. Configure external
monitoring/alerts for unhealthy containers, sweep errors, free disk/RAM and backup
freshness. Container logs rotate at 3 × 10 MB per service. Reboot auto-restarts the
long-lived services; migrations are a release operation, not run on every restart.

## Releases and migrations

Take and verify a backup first. For later releases, stop writers while migrating:

```sh
docker compose stop caddy routines attachment-cleanup app
# Build the new release, or pull the immutable image as described above.
docker compose build app
docker compose run --rm --no-deps migrate
docker compose up -d --force-recreate
docker compose logs migrate
```

Do not proceed to `up` if the migration command fails. Do not run migrations from
two shells concurrently. A plain restart does not guarantee a completed one-shot
service is rerun; the explicit command above makes each release deliberate.

## Backups

Enable DigitalOcean **weekly Droplet backups** as a second recovery layer. They do
not replace database backups or cover attached Volumes automatically. See
<https://docs.digitalocean.com/products/backups/>.

Schedule a **nightly logical dump streamed off-box** from a restricted administrator
account, for example with a systemd timer (replace paths/host and provision SSH keys):

```sh
cd /srv/OpenDuet/openbot/deploy/pilot
set -o pipefail
docker compose exec -T postgres pg_dump -U cue -d cue -Fc \
  | ssh backup-user@backup-host 'umask 077; cat > cue-$(date -u +%F).dump'
```

Run this with Bash; retain at least seven daily and four weekly copies, encrypt the
backup destination, monitor exit status and alert on missing/stale dumps. The file
can be partial after failure; mark/rotate successful copies only. Save `.env`
separately in an encrypted secret store, including the encryption key. Keep it out
of source control, ordinary logs and unencrypted backups. Back up Caddy volumes
and any future workspace/profile data separately if needed.

Practice restoring a dump to a disposable Postgres 16 database before launch and
regularly thereafter. With application writers stopped, a restore into an empty
replacement pilot database is:

```sh
cat cue-YYYY-MM-DD.dump | docker compose exec -T postgres \
  pg_restore -U cue -d cue --exit-on-error --no-owner
```

This is **not** an in-place overwrite command. Create the empty replacement DB
first, restore it, validate counts and sign-in/chat, then switch traffic. Preserve
the original volume until recovery is accepted.

## Rollback and teardown

- Stop Caddy, routines, cleanup and the app. Keep the database and all volumes.
- If the old image is compatible with the migrated schema, set `CUE_APP_IMAGE` to
  its recorded immutable reference and use `docker compose up -d --no-build
  --force-recreate`. The migration journal must also be compatible; test this on
  a restored copy first. Migrations are forward-only, not automatic down-migrations.
- If incompatible, restore the pre-release dump to an empty replacement database
  and use the matching previous image. This loses writes since the backup; obtain
  operator approval before switching. Never roll an old migrator across a newer
  schema blindly. Preserve old volumes and snapshots for recovery.
- Reversible shutdown: `docker compose down` (no `--volumes`), remove DNS/firewall
  exposure if retiring, and keep the Droplet/data until backups are verified.
- **Destructive retirement only after approval:** `docker compose down --volumes`
  deletes this project's database, workspace, profiles and Caddy certificate state.
  Delete the Droplet/paid resources separately, revoke provider keys/OAuth secrets,
  and apply the school's data-retention policy. Never use volume pruning as rollback.

## Local verification only

`compose.local.yaml` and `Caddyfile.local` are explicitly non-production test
fixtures. Combine them only on a development machine, with synthetic Google
credentials and generated test secrets supplied through the shell. Supply the
required base Compose variables even though this override replaces Google auth.

```sh
export CUE_DOMAIN=localhost INITIAL_ADMIN_EMAILS=test@example.invalid
export SIGNIN_ALLOWED_EMAIL_DOMAINS=example.invalid
export GOOGLE_OAUTH_CLIENT_ID=local-test GOOGLE_OAUTH_CLIENT_SECRET=local-test
export INTELLIGENCE_API_KEY=local-test-only
export INTELLIGENCE_API_URL=http://intelligence:7091
export INTELLIGENCE_GATEWAY_WS_URL=ws://intelligence:7091
# Export the four generated test secrets and OPENAI_API_KEY (never save the live key).
docker compose -p cue-pilot-test -f compose.yaml -f compose.local.yaml up -d
curl --fail http://localhost:8080/health
docker compose -p cue-pilot-test -f compose.yaml -f compose.local.yaml logs migrate
docker compose -p cue-pilot-test -f compose.yaml -f compose.local.yaml down --volumes
```

The override publishes **only 127.0.0.1:8080**, uses plain HTTP on localhost, disables
OAuth for a synthetic local administrator, and adds the stand-in only on the test
network. It intentionally keeps threads in memory. This is a headless API fixture:
the runner uses Docker's `intelligence` hostname, which a host browser cannot resolve.
For a manual WebSocket check, connect to `ws://localhost:8080/intelligence/client/websocket`
with a synthetic thread's join token. The proxy strips `/intelligence/` before
forwarding to the stand-in. A full browser chat test needs a gateway hostname
reachable from both Docker and the browser; this fixture does not configure one.
Never use this override with a public
IP, hostname, real student data or production volumes. Local verification cannot
prove public ACME issuance, real Google OAuth admission or managed Intelligence
readiness; test those separately when deployment is authorized.
