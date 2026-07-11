# Deployment Guide

This guide explains how to run BanKing in production. BanKing is a local-first application: it does not
require a cloud provider, an external database, or any environment variables. Everything runs on a single
machine and stores its data in a local JSON file.

## 1. Prerequisites

- **Node.js 20.x or later**
- **npm** (bundled with Node.js)

Check your installed version:

```bash
node -v
npm -v
```

## 2. Build the Application

From the project root, install dependencies and create a production build:

```bash
npm install
npm run build
```

`npm run build` compiles and type-checks the TypeScript source, optimizes and bundles all pages and
assets, and writes the production output to the `.next/` directory. This step must be re-run any time
the source code changes.

## 3. Run the Production Server

Start the optimized production server:

```bash
npm run start
```

By default, this starts the app on **port 3000**. Open `http://localhost:3000` in a browser to confirm
it is running.

`npm run start` must always be run after `npm run build`. Do not use `npm run dev` in production —
the dev server is slower and intended for local development only.

## 4. Port & Host Configuration

### Change the port

Set the `PORT` environment variable before starting the server:

```bash
PORT=8080 npm run start
```

The app will then be available at `http://localhost:8080`.

### Listen on all network interfaces

By default, the server only accepts connections from the same machine (`localhost`). To make BanKing
reachable from other devices on your network (for example, accessing it from a phone or another
computer), bind it to all interfaces using the underlying `next start` command directly:

```bash
npx next start -p 8080 -H 0.0.0.0
```

- `-p 8080` sets the port.
- `-H 0.0.0.0` listens on all network interfaces instead of only `localhost`.

Only expose BanKing to your local network or the internet if you understand the security implications —
see [Data & Security](../README.md#data--security) in the README.

## 5. Data Directory

BanKing stores all application data locally in `data/db.json` using LowDB (a file-based JSON database).

- The `data/` directory is listed in `.gitignore`, so it will **not** exist after cloning the repository
  for the first time.
- The directory and database file are created automatically the first time a sync runs (or the first
  time data is written), so no manual setup is required for a fresh deployment.
- Back up the entire `data/` directory periodically if you want to preserve your transaction history.

## 6. Banking Credentials

To sync real transactions, BanKing needs DKB session credentials. You have two options:

1. **Settings page (recommended):** Start the app and open `/settings` in the browser to enter and save
   your credentials through the UI.
2. **Manual file:** Create `banking.config.json` in the project root by hand. This file is gitignored and
   never committed.

See the [README](../README.md#option-2-connect-your-dkb-account) for the exact file format and full
sync instructions. DKB session credentials expire after 15-30 minutes of inactivity and need to be
refreshed periodically.

## 7. Running as a Background Service

To keep BanKing running after you close your terminal or reboot the machine, run it as a managed
background service.

### Option A: PM2 (recommended, cross-platform)

[PM2](https://pm2.keymetrics.io/) is a simple process manager for Node.js applications.

```bash
npm install -g pm2

# From the project root, after npm run build
pm2 start npm --name banking -- start

# Persist the process list and configure PM2 to start on boot
pm2 save
pm2 startup
```

Useful PM2 commands:

```bash
pm2 status           # Check if BanKing is running
pm2 logs banking      # View live logs
pm2 restart banking   # Restart after an update
pm2 stop banking      # Stop the service
```

### Option B: systemd (Linux)

Create a unit file at `/etc/systemd/system/banking.service`:

```ini
[Unit]
Description=BanKing - Personal Banking Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/banking
ExecStart=/usr/bin/npm run start
Restart=on-failure
Environment=PORT=3000
User=your-username

[Install]
WantedBy=multi-user.target
```

Replace `/path/to/banking` and `your-username` with the real path and the account that should run the
service. Then enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable banking
sudo systemctl start banking
sudo systemctl status banking
```

## 8. Running with Docker (Optional)

If you prefer container isolation, BanKing can run in Docker. There is no Dockerfile in the repository
by default, so create one at the project root:

```dockerfile
# Dockerfile

# --- Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Production runtime ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "run", "start"]
```

Add a `.dockerignore` file next to it to keep the build context small and avoid copying local secrets
or generated files into the image:

```text
node_modules
.next
data
banking.config.json
.git
```

Build and run the image, mounting `data/` and `banking.config.json` as volumes so your data and
credentials persist outside the container:

```bash
docker build -t banking .

docker run -d \
  --name banking \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/banking.config.json:/app/banking.config.json" \
  banking
```

## 9. Updating to a New Version

When new changes are pulled in, rebuild and restart the service:

```bash
git pull
npm install
npm run build
```

Then restart with whichever method you used to run the service:

```bash
pm2 restart banking          # PM2
sudo systemctl restart banking  # systemd
docker restart banking        # Docker
```

## 10. Troubleshooting

**Port already in use**

```
Error: listen EADDRINUSE: address already in use :::3000
```

Another process is already using that port. Either stop it or start BanKing on a different port
(see [Port & Host Configuration](#4-port--host-configuration)).

**Missing data directory**

If you see errors reading or writing `data/db.json` on a fresh install, ensure the process has write
permission to the project directory. The `data/` directory and `db.json` file are created
automatically on first use, so this usually indicates a permissions issue rather than a missing
folder.

**Expired bank credentials**

Sync requests failing with authentication errors usually mean the DKB session cookie has expired.
Refresh it from the Settings page (`/settings`) or update `banking.config.json` manually, then trigger
the sync again.

**Build errors**

Run the following before reporting an issue, and address any errors reported:

```bash
npm run lint
npx tsc --noEmit
```

Make sure `npm install` completed without errors and that you are using Node.js 20.x or later.
