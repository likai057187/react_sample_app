# Build, push, and deploy Chromatic Resonance to Google Cloud Run.
# Run from the repository root:
#   .\infra\deploy.ps1

param(
    [switch]$SkipBuild,
    [switch]$SkipPush,
    [switch]$SkipApply
)

$ErrorActionPreference = "Stop"

function Read-TfVarString($Name) {
    $path = Join-Path $PSScriptRoot "terraform.tfvars"
    if (-not (Test-Path $path)) {
        return $null
    }
    $line = Get-Content $path | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -First 1
    if (-not $line) {
        return $null
    }
    return ($line -replace '^\s*[^=]+\s*=\s*"', '' -replace '"\s*(#.*)?$', '').Trim()
}

Push-Location $PSScriptRoot
try {
    terraform init
    if ($LASTEXITCODE -ne 0) { throw "terraform init failed" }

    Write-Host "`nEnsuring Artifact Registry exists..." -ForegroundColor Yellow
    terraform apply `
        -target=google_project_service.artifactregistry `
        -target=google_artifact_registry_repository.docker `
        -auto-approve
    if ($LASTEXITCODE -ne 0) { throw "terraform apply -target failed" }

    $REGISTRY = terraform output -raw artifact_registry
    if (-not $REGISTRY) { throw "Could not read artifact_registry Terraform output" }
}
finally {
    Pop-Location
}

$REGION = ($REGISTRY -split "-docker.pkg.dev")[0]
$APP_KEY = $env:APP_API_KEY
if (-not $APP_KEY) {
    $APP_KEY = Read-TfVarString "app_api_key"
}
if (-not $APP_KEY) {
    throw "Could not read app_api_key. Set APP_API_KEY or add app_api_key to infra/terraform.tfvars."
}

$GIT_SHA = (git rev-parse --short HEAD 2>$null)
if (-not $GIT_SHA) {
    $GIT_SHA = Get-Date -Format "yyyyMMddHHmmss"
}
$IMAGE = "$REGISTRY/app:$GIT_SHA"

Write-Host "`n=== Chromatic Resonance Deploy ===" -ForegroundColor Cyan
Write-Host "Registry: $REGISTRY"
Write-Host "Image:    $IMAGE"

Write-Host "`nAuthenticating Docker with Artifact Registry..." -ForegroundColor Yellow
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
if ($LASTEXITCODE -ne 0) { throw "Docker auth failed" }

if (-not $SkipBuild) {
    Write-Host "`nBuilding app image..." -ForegroundColor Yellow
    docker build `
        -f infra/Dockerfile.app `
        --build-arg EXPO_PUBLIC_API_ORIGIN="" `
        --build-arg EXPO_PUBLIC_API_KEY="$APP_KEY" `
        -t "$IMAGE" .
    if ($LASTEXITCODE -ne 0) { throw "Docker build failed" }
}

if (-not $SkipPush) {
    Write-Host "`nPushing app image..." -ForegroundColor Yellow
    docker push "$IMAGE"
    if ($LASTEXITCODE -ne 0) { throw "Docker push failed" }
}

if (-not $SkipApply) {
    Push-Location $PSScriptRoot
    try {
        Write-Host "`nApplying Terraform with new image..." -ForegroundColor Yellow
        terraform apply -var="container_image=$IMAGE"
        if ($LASTEXITCODE -ne 0) { throw "terraform apply failed" }

        $URL = terraform output -raw cloud_run_url
        Write-Host "`nDeploy complete: $URL" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}
