---
description: Steps to deploy the Drug Interaction App to a server
---

1. Verify Docker and Docker Compose are installed on target.
2. Build and start the container.
// turbo
3. `docker-compose up --build -d`
4. Monitor logs to confirm DB initialization.
// turbo
5. `docker-compose logs --tail=20`
