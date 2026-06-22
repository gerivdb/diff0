# Architecture — diff0-fork v2.0.0
# IntentHash: 0xDIFF0_FORK_ARCHITECTURE_20260604

## Flux principal

```
PR ouverte sur gerivdb/BRAIN
        |
        v
[GitHub Webhook] --HMAC-SHA256--> [Express server :3000]
                                        |
                            +-----------+-----------+
                            |  Delivery ID check    |  (SQLite idempotency)
                            +-----------+-----------+
                                        |
                            +-----------v-----------+
                            |  LXC/LXD sandbox      |  (KIVA orchestration)
                            |  Clone + diff extract |
                            |  TTL 5min             |
                            +-----------+-----------+
                                        |
                            +-----------v-----------+
                            |  BRAIN.codeAnalysis   |  (via GATEWAY-MANAGER)
                            |  Retour TritVector[5] |  (BDCP enforced)
                            +-----------+-----------+
                                        |
                            +-----------v-----------+
                            |  TritThermoGate       |
                            |  +1 POST inline       |
                            |   0 LOG only          |
                            |  -1 ESCALADE FLUX     |
                            +-----------+-----------+
                                        |
                +-----------------------+-----------------------+
                |                       |                       |
        [GitHub inline]         [NEXUS WAL + VDB]       [FLUENCE signal]
        review comments         review_completed         patterns
```

## Structure des packages

```
diff0-fork/
  packages/
    backend/
      src/
        server.js          # Express server + webhook receiver
        db/
          database.js      # SQLite + tables (deliveries, reviews, ternary_reviews)
          deliveries.js    # Idempotency tracking
          reviews.js       # Review history
        llm/
          client.js        # LLM via GATEWAY-MANAGER (BDCP)
        thermo/
          gate.js          # TritThermoGate (+1/0/-1)
        sandbox/
          manager.js       # LXC/LXD orchestration via KIVA
        github/
          comments.js      # GitHub inline review comments
      tests/
        test_basic.js      # Tests unitaires
    cli/
      src/
        review.js          # CLI manuel (kiva review)
    sandbox/
      lxc/
        worker.js          # LXC worker (create/exec/destroy)
  config/
    targets.yaml           # Repos cibles (HIGH/MEDIUM)
  docs/
    ARCHITECTURE.md        # Ce fichier
  .env.example             # Configuration
  package.json
  README.md
```

## Contraintes

| Contrainte | Implementation |
|-----------|---------------|
| BDCP | Tout LLM via GATEWAY-MANAGER (localhost:9000) |
| D4 | 0 auto-merge, -1 -> FLUX HITL |
| CONTAINER_POLICY | LXC/LXD via KIVA, pas Docker |
| ENV2-z600 | Xeon E5620 no AVX, Node 22, 4GB max sandbox |
