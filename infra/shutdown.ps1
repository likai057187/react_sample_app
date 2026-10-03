# Tear down Chromatic Resonance GCP resources (VM, secrets, Artifact Registry repo).
# Stops billable compute; leaves the GCP project itself.
#
# Usage (from repo root):
#   .\infra\shutdown.ps1
#   .\infra\shutdown.ps1 -WhatIf

param(
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$InfraDir = $PSScriptRoot

Push-Location $InfraDir
try {
    if (-not (Test-Path "terraform.tfvars")) {
        throw "Missing infra/terraform.tfvars"
    }

    Write-Host "`nTerraform destroy (VM, secrets, registry, IAM)..." -ForegroundColor Yellow
    if ($WhatIf) {
        terraform plan -destroy
    } else {
        terraform destroy -auto-approve
        if ($LASTEXITCODE -ne 0) { throw "terraform destroy failed" }
    }

    Write-Host "`nDone. Billable Chromatic Resonance stack removed." -ForegroundColor Green
} finally {
    Pop-Location
}
