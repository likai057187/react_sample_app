# Build, push Docker images to Artifact Registry, and redeploy VM.
# Usage: .\infra\deploy.ps1
# Run from the repository root (react_sample_app/)

param(
    [switch]$SkipBuild,
    [switch]$SkipPush,
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Read-TfVarString($Name) {
    $path = Join-Path $PSScriptRoot "terraform.tfvars"
    if (-not (Test-Path $path)) { return $null }
    $line = Get-Content $path | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -First 1
    if (-not $line) { return $null }
    return ($line -replace '^\s*[^=]+\s*=\s*"', '' -replace '"\s*(#.*)?$', '').Trim()
}

Push-Location $PSScriptRoot
$REGISTRY = (terraform output -raw registry 2>$null)
$VM_IP = (terraform output -raw vm_ip 2>$null)
$PROJECT_ID = Read-TfVarString "project_id"
$ZONE = Read-TfVarString "zone"
if (-not $ZONE) { $ZONE = "us-central1-a" }
Pop-Location

if (-not $REGISTRY) {
    Write-Error "Could not read registry from Terraform output. Run 'terraform apply' in infra/ first."
    exit 1
}

$APP_KEY = $env:APP_API_KEY
if (-not $APP_KEY) { $APP_KEY = Read-TfVarString "app_api_key" }
if (-not $APP_KEY) {
    Write-Error "Could not read app_api_key. Set APP_API_KEY or add it to infra/terraform.tfvars."
    exit 1
}

Write-Host "`n=== Chromatic Resonance Deploy ===" -ForegroundColor Cyan
Write-Host "Registry: $REGISTRY"
Write-Host "VM IP:    $VM_IP"

$REGION = ($REGISTRY -split "-docker.pkg.dev")[0]
Write-Host "`n[1/5] Authenticating Docker with Artifact Registry..." -ForegroundColor Yellow
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
if ($LASTEXITCODE -ne 0) { Write-Error "Docker auth failed"; exit 1 }

if (-not $SkipBuild) {
    Write-Host "`n[2/5] Building app image..." -ForegroundColor Yellow
    docker build `
        -f (Join-Path $PSScriptRoot "Dockerfile.app") `
        --build-arg EXPO_PUBLIC_API_ORIGIN="" `
        --build-arg EXPO_PUBLIC_API_KEY="$APP_KEY" `
        -t "${REGISTRY}/app:latest" `
        $RepoRoot
    if ($LASTEXITCODE -ne 0) { Write-Error "App build failed"; exit 1 }

    Write-Host "`n[3/5] Building nginx image..." -ForegroundColor Yellow
    docker build `
        -f (Join-Path $PSScriptRoot "Dockerfile.nginx") `
        -t "${REGISTRY}/nginx:latest" `
        $RepoRoot
    if ($LASTEXITCODE -ne 0) { Write-Error "Nginx build failed"; exit 1 }
} else {
    Write-Host "`n[2-3/5] Skipping builds" -ForegroundColor DarkGray
}

if (-not $SkipPush) {
    Write-Host "`n[4/5] Cleaning old images & pushing new ones..." -ForegroundColor Yellow

    $ErrorActionPreference = "Continue"
    gcloud artifacts docker images delete "${REGISTRY}/app" --delete-tags --quiet 2>&1 | Out-Null
    gcloud artifacts docker images delete "${REGISTRY}/nginx" --delete-tags --quiet 2>&1 | Out-Null
    $ErrorActionPreference = "Stop"

    docker push "${REGISTRY}/app:latest"
    if ($LASTEXITCODE -ne 0) { Write-Error "App push failed"; exit 1 }

    docker push "${REGISTRY}/nginx:latest"
    if ($LASTEXITCODE -ne 0) { Write-Error "Nginx push failed"; exit 1 }

    Write-Host "`nRegistry storage:" -ForegroundColor Gray
    gcloud artifacts docker images list $REGISTRY --format="table(package,tags,size)"
} else {
    Write-Host "`n[4/5] Skipping push" -ForegroundColor DarkGray
}

if (-not $SkipDeploy) {
    Write-Host "`n[5/5] Redeploying on VM..." -ForegroundColor Yellow
    if (-not $PROJECT_ID) {
        $PROJECT_ID = ($REGISTRY -split '/')[1]
    }
    $deployCmd = "sudo bash -c '/opt/chromatic-resonance/compose.sh pull && /opt/chromatic-resonance/compose.sh up -d && echo Waiting for app... && sleep 15 && curl -sf http://localhost/ >/dev/null && echo Deploy complete!'"
    gcloud compute ssh chromatic-resonance-vm --zone=$ZONE --project=$PROJECT_ID --strict-host-key-checking=no --quiet --command=$deployCmd
    if ($LASTEXITCODE -ne 0) { Write-Error "VM deploy failed"; exit 1 }
} else {
    Write-Host "`n[5/5] Skipping deploy" -ForegroundColor DarkGray
}

Write-Host "`n=== Deploy Complete ===" -ForegroundColor Green
Write-Host "Web:  http://$VM_IP"
Write-Host "Prod: https://auction.rhythmmm.org (after DNS + SSL)"
