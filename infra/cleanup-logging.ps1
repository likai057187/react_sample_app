# Minimize Cloud Logging storage cost for a GCP project.
# - Sets _Default bucket retention to 1 day (logs older than 1 day are purged within ~24h).
# - _Required (audit) bucket is locked at 400 days by Google; cannot be shortened or deleted.
#
# Usage: .\infra\cleanup-logging.ps1

$ErrorActionPreference = "Stop"
$ProjectId = (gcloud config get-value project 2>$null).Trim()
if (-not $ProjectId) { throw "Set gcloud project: gcloud config set project YOUR_PROJECT_ID" }

Write-Host "Project: $ProjectId" -ForegroundColor Cyan
Write-Host "`nLog buckets:" -ForegroundColor Yellow
gcloud logging buckets list --project=$ProjectId --format="table(name.basename(),location,retentionDays,locked)"

Write-Host "`nSetting _Default retention to 1 day..." -ForegroundColor Yellow
gcloud logging buckets update _Default `
  --location=global `
  --project=$ProjectId `
  --retention-days=1 `
  --quiet

Write-Host "`nDone. _Default logs older than 1 day will be removed within about 24 hours." -ForegroundColor Green
Write-Host "_Required (audit) stays at 400 days (platform-managed, locked)." -ForegroundColor DarkGray
Write-Host "Optional: Console -> Logging -> Log storage -> review usage and excluded logs." -ForegroundColor DarkGray
