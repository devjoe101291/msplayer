NewPipe Extractor Server (local)
--------------------------------

1. Download the extractor server JAR:
   - Releases: https://github.com/TeamNewPipe/newpipe-extractor/releases
   - Save the JAR as: `newpipe/newpipe-extractor-server.jar`

2. Start via Docker Compose (project root):
```bash
docker compose up -d
# or
docker-compose up -d
```

3. Or run directly with Java (no Docker):
```bash
java -jar ./newpipe/newpipe-extractor-server.jar --server.port=7071
```

4. Ensure your app `.env` contains:
```
NEWPIPE_SERVICE_URL=http://127.0.0.1:7071
```

Notes:
- The UI expects the extractor at `NEWPIPE_SERVICE_URL`.
- If the extractor is unreachable, YouTube searches/imports will show a notice.
