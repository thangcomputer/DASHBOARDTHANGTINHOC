# 01. MONGODB RUNTIME TOPOLOGY

## Forensic Audit

- **Environment**: Local/Test (Docker Compose)
- **File Checked**: `docker-compose.yml`
- **Current Configuration**:
  ```yaml
  mongo:
    image: mongo:7
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
  ```

## Current Topology Detection
- **Topology**: [STANDALONE]
- **MongoDB Version**: 7.x
- **Replica Set Configuration**: None (`--replSet` missing, `rs.initiate()` never run).
- **Application URI**: `mongodb://mongo:27017/dashboardthangtinhoc` (in docker), or `mongodb://localhost:27017/thangtinhoc` (local `.env`).
