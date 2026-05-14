# Chromatic Resonance GCP Infrastructure

Terraform for deploying the Expo web app, Fastify API, Socket.IO, and Postgres
database to Google Cloud.

## Architecture

```text
Internet
  -> Cloud Run HTTPS service
       -> Fastify API: /api/*
       -> Socket.IO: /socket.io/*
       -> Expo web static bundle
       -> artwork media: /api/media/*
  -> Cloud SQL for PostgreSQL
  -> Secret Manager for API/database/Roboflow secrets
  -> Artifact Registry for the app container image
```

The app is packaged as one container. During image build, Expo exports the web
bundle into `client/dist`; at runtime Fastify serves both the API and the static
web app.

## Sizing For 100 Concurrent Users

Default sizing is intentionally conservative for a live event with QR scanning,
auction polling/WebSockets, static image traffic, and shared forum writes:

- Cloud Run: `1 vCPU`, `1 GiB`, concurrency `100`, min instances `1`, max
  instances `2`.
- Cloud SQL Postgres: `db-custom-1-3840` (1 vCPU, 3.75 GiB RAM), 20 GB SSD
  with backups and point-in-time recovery.

Why not a tiny VM: the phone camera flow needs HTTPS, and Cloud Run gives a
managed HTTPS URL immediately. It also avoids managing nginx/certbot while still
supporting WebSockets.

If you later add cross-instance Socket.IO fanout, you can increase
`cloud_run_max_instances`. Until then, keep it low so most live users stay on a
small number of instances.

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

.\infra\deploy.ps1
```

The deploy script:

1. Initializes Terraform.
2. Creates the Artifact Registry repository if needed.
3. Builds the app image with the public Expo API key embedded.
4. Pushes the image to Artifact Registry.
5. Applies Terraform for Cloud Run, Cloud SQL, IAM, and secrets.

After deploy:

```powershell
cd infra
terraform output cloud_run_url
```

## Updating The App

Run:

```powershell
.\infra\deploy.ps1
```

The script tags images with the current git SHA and updates Cloud Run to the new
image.

## Notes

- `app_api_key` is compiled into the web bundle because the current app requires
  the browser to send `X-Api-Key`. Treat it as a gate, not a private server
  secret.
- `API_KEY`, `DATABASE_URL`, and optional `ROBOFLOW_API_KEY` are provided to the
  server through Cloud Run environment variables and Secret Manager.
- The container runs `prisma db push` at startup so a fresh Cloud SQL database
  gets the current schema.
- `terraform.tfvars`, state files, and plans are ignored by `infra/.gitignore`.

## Destroy

```powershell
cd infra
terraform destroy
```

Cloud SQL has deletion protection enabled. To destroy the database, first set:

```hcl
# database.tf
deletion_protection = false
```

Then run `terraform apply` followed by `terraform destroy`.
