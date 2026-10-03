#!/bin/bash
set -euo pipefail
exec > >(tee -a /var/log/chromatic-resonance-startup.log) 2>&1
echo "[$(date -Iseconds)] Starting Chromatic Resonance bootstrap..."

PROJECT_ID="${project_id}"
REGION="${region}"
APP_NAME="${app_name}"
REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/$APP_NAME"
APP_DIR="/opt/$APP_NAME"
MARKER="$APP_DIR/.deployed"

fetch_secret() {
  local value
  value=$(gcloud secrets versions access latest \
    --secret="$1" --project="$PROJECT_ID" 2>/dev/null) || true
  if [ -z "$value" ]; then
    echo "FATAL: Cannot fetch secret $1" >&2
    return 1
  fi
  echo "$value"
}

if [ ! -f "$MARKER" ]; then
  echo "=== First-boot setup ==="

  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg jq

  install -m 0755 -d /usr/share/keyrings
  curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | \
    gpg --batch --yes --dearmor -o /usr/share/keyrings/cloud.google.gpg
  echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
    > /etc/apt/sources.list.d/google-cloud-sdk.list

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | \
    gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  ARCH=$(dpkg --print-architecture)
  CODENAME=$(. /etc/os-release && echo $VERSION_CODENAME)
  echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/debian $CODENAME stable" > \
    /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin google-cloud-cli
  systemctl enable docker
  systemctl start docker

  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi

  mkdir -p "$APP_DIR"
  cat > "$APP_DIR/docker-compose.prod.yml" <<'COMPOSE'
services:
  postgres:
    image: postgres:16-alpine
    container_name: chromatic-resonance-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: auction
      POSTGRES_PASSWORD: $${DB_PASSWORD}
      POSTGRES_DB: chromatic_resonance
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U auction"]
      interval: 5s
      timeout: 3s
      retries: 10
    deploy:
      resources:
        limits:
          memory: 256M
    command:
      - "postgres"
      - "-c"
      - "shared_buffers=64MB"
      - "-c"
      - "max_connections=30"
      - "-c"
      - "work_mem=2MB"

  app:
    image: $${REGISTRY}/app:latest
    container_name: chromatic-resonance-app
    restart: unless-stopped
    environment:
      PORT: "3000"
      API_KEY: $${API_KEY}
      DATABASE_URL: "postgresql://auction:$${DB_PASSWORD}@postgres:5432/chromatic_resonance?schema=public"
      ROBOFLOW_API_KEY: $${ROBOFLOW_API_KEY}
      ROBOFLOW_MODEL_ID: $${ROBOFLOW_MODEL_ID}
      ROBOFLOW_INFERENCE_URL: $${ROBOFLOW_INFERENCE_URL}
      DISCOVERY_MATCH_THRESHOLD: $${DISCOVERY_MATCH_THRESHOLD}
      NODE_OPTIONS: "--max-old-space-size=384"
    depends_on:
      postgres:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 448M

  web:
    image: $${REGISTRY}/nginx:latest
    container_name: chromatic-resonance-web
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - letsencrypt:/etc/letsencrypt:ro
      - certbot-webroot:/var/www/certbot:ro
    depends_on:
      - app
    deploy:
      resources:
        limits:
          memory: 64M

volumes:
  pgdata:
  letsencrypt:
  certbot-webroot:
COMPOSE

  cat > "$APP_DIR/compose.sh" <<WRAPPER
#!/bin/bash
set -euo pipefail

PROJECT_ID=\$(curl -s "http://metadata.google.internal/computeMetadata/v1/project/project-id" -H "Metadata-Flavor: Google")
REGION=\$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/zone" -H "Metadata-Flavor: Google" | sed 's|.*/zones/\\([a-z]*-[a-z]*[0-9]*\\).*|\\1|')

fetch_secret() {
  gcloud secrets versions access latest --secret="\$1" --project="\$PROJECT_ID" 2>/dev/null
}

export DB_PASSWORD=\$(fetch_secret "${app_name}-db-password")
export API_KEY=\$(fetch_secret "${app_name}-api-key")
export ROBOFLOW_API_KEY=\$(fetch_secret "${app_name}-roboflow-api-key" 2>/dev/null || echo "")
export ROBOFLOW_MODEL_ID="${roboflow_model_id}"
export ROBOFLOW_INFERENCE_URL="${roboflow_inference_url}"
export DISCOVERY_MATCH_THRESHOLD="${discovery_match_threshold}"
export REGISTRY="\$REGION-docker.pkg.dev/\$PROJECT_ID/${app_name}"

cd "$APP_DIR"
exec docker compose -f docker-compose.prod.yml "\$@"
WRAPPER
  chmod 700 "$APP_DIR/compose.sh"

  touch "$MARKER"
  echo "First-boot setup complete."
fi

gcloud auth configure-docker $REGION-docker.pkg.dev --quiet

export DB_PASSWORD=$(fetch_secret "${app_name}-db-password")
export API_KEY=$(fetch_secret "${app_name}-api-key")
export ROBOFLOW_API_KEY=$(fetch_secret "${app_name}-roboflow-api-key" 2>/dev/null || echo "")
export ROBOFLOW_MODEL_ID="${roboflow_model_id}"
export ROBOFLOW_INFERENCE_URL="${roboflow_inference_url}"
export DISCOVERY_MATCH_THRESHOLD="${discovery_match_threshold}"
export REGISTRY

cd "$APP_DIR"

docker compose -f docker-compose.prod.yml pull || true
docker compose -f docker-compose.prod.yml up -d

echo "=== Deployment complete at $(date -Iseconds) ==="
