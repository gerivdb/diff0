# Setup proc — GitHub App pour diff0-fork
# IntentHash: 0xDIFF0_FORK_GITHUB_APP_SETUP_20260604
#
# Creer une GitHub App gerivdb/diff0-fork-review
#
# 1. Aller sur https://github.com/settings/apps/new
# 2. Configurer:
#    - App name: diff0-fork-review
#    - Homepage: https://github.com/gerivdb/diff0-fork
#    - Webhook URL: http://<host>:3000/webhook
#    - Webhook secret: generer avec `openssl rand -hex 32`
# 3. Permissions:
#    - Pull requests: Read-only
#    - Pull requests (org): Read and write (pour inline comments)
#    - Metadata: Read-only
# 4. Subscribe to events:
#    - Pull request
# 5. Create App, enregistrer:
#    - APP_ID
#    - PRIVATE_KEY (.pem)
#    - WEBHOOK_SECRET
# 6. Installer l'App sur les 10 repos HIGH:
#    BRAIN, KIVA, KIVA-CLI, NEXUS, ECOYSTEM, GATEWAY-MANAGER,
#    FLUENCE, ECOS-CLI, ARGUS, ONTOLOGY
# 7. Peupler .env avec les valeurs
# 8. Lancer: npm start

# --- Generer webhook secret ---
# openssl rand -hex 32

# --- Fichier .env a creer (jamais commit) ---
# GITHUB_APP_ID=<app_id>
# GITHUB_PRIVATE_KEY_PATH=./config/diff0-fork-private-key.pem
# GITHUB_WEBHOOK_SECRET=<webhook_secret>
# GITHUB_TOKEN=<installation_token>
# PORT=3000
# GATEWAY_URL=http://localhost:9000
# DB_PATH=./packages/backend/data/diff0.db
