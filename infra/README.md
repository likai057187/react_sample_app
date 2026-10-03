# Chromatic Resonance GCP Infrastructure

Terraform for deploying the Expo web app, Fastify API, Socket.IO, and Postgres
to a single e2-micro VM (same pattern as JIT Dining).

## Architecture

```text
Internet
  -> Wix DNS (auction.rhythmmm.org A record -> VM IP)
  -> nginx (TLS via Let's Encrypt)
       -> Fastify app: /api/*, /socket.io/*, SPA, /api/media/*
  -> PostgreSQL (Docker on VM)
  -> Secret Manager for API/database/Roboflow secrets
  -> Artifact Registry for app + nginx images
```

Cost is roughly $7–10/month for a second e2-micro (vs ~$85–130/month on Cloud Run + Cloud SQL).

## Prerequisites

1. Google Cloud project with billing enabled.
2. Terraform >= 1.5.
3. `gcloud` authenticated:
   ```powershell
   gcloud auth login
   gcloud auth application-default login
   ```
4. Docker running locally.

## First Deploy

From the repository root:

```powershell
Copy-Item infra/terraform.tfvars.example infra/terraform.tfvars
# Edit infra/terraform.tfvars with your project_id, app_api_key, db_password,
# and optional Roboflow values.

cd infra
terraform init
terraform apply

cd ..
.\infra\deploy.ps1
```

## SSL (Let's Encrypt)

After DNS points `auction.rhythmmm.org` to the VM IP:

```bash
gcloud compute ssh chromatic-resonance-vm --zone=us-central1-a --project=YOUR_PROJECT_ID

# On the VM:
sudo docker stop chromatic-resonance-web
sudo apt-get update && sudo apt-get install -y certbot
sudo certbot certonly --standalone -d auction.rhythmmm.org --agree-tos -m your@email.com --non-interactive
sudo docker volume create chromatic-resonance_letsencrypt
sudo docker run --rm -v chromatic-resonance_letsencrypt:/dest -v /etc/letsencrypt:/src alpine \
  sh -c "cp -r /src/live /src/archive /src/renewal /dest/ 2>/dev/null || cp -rL /src/live /dest/"
sudo docker volume create chromatic-resonance_certbot-webroot
sudo /opt/chromatic-resonance/compose.sh up -d
```

## Database restore

Copy a SQL dump to the VM and restore into the Postgres container:

```bash
gcloud compute scp dump.sql chromatic-resonance-vm:/tmp/ --zone=us-central1-a
gcloud compute ssh chromatic-resonance-vm --zone=us-central1-a --command="sudo docker exec -i chromatic-resonance-db psql -U auction -d chromatic_resonance < /tmp/dump.sql"
```

## Updating The App

```powershell
.\infra\deploy.ps1
```

## Destroy

```powershell
.\infra\shutdown.ps1
```
