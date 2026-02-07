# Set GitHub Actions secrets and variables for Azure deploy from environment variables.
# Requires: GitHub CLI (gh) installed and authenticated (gh auth login).
# If execution is restricted: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# Usage (PowerShell):
#   $env:AZURE_CLIENT_ID = "..."
#   $env:AZURE_TENANT_ID = "..."
#   $env:AZURE_SUBSCRIPTION_ID = "..."
#   $env:AZURE_ACR_NAME = "truthlayeracr"
#   $env:AZURE_RESOURCE_GROUP = "truthlayer-rg"
#   $env:AZURE_CONTAINER_APP_NAME = "truthlayer-playground"
#   .\scripts\set-github-azure-secrets.ps1
# Or run from repo root after setting env vars.

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "GitHub CLI (gh) is required. Install from https://cli.github.com/ and run 'gh auth login'."
    exit 1
}

$secrets = @("AZURE_CLIENT_ID", "AZURE_TENANT_ID", "AZURE_SUBSCRIPTION_ID")
foreach ($name in $secrets) {
    $val = [Environment]::GetEnvironmentVariable($name, "Process")
    if ([string]::IsNullOrEmpty($val)) { $val = [Environment]::GetEnvironmentVariable($name, "User") }
    if ([string]::IsNullOrEmpty($val)) { $val = [Environment]::GetEnvironmentVariable($name, "Machine") }
    if ([string]::IsNullOrEmpty($val)) {
        Write-Warning "$name is not set; skipping."
    } else {
        $val | gh secret set $name
        Write-Host "Set secret: $name"
    }
}

$variables = @("AZURE_ACR_NAME", "AZURE_RESOURCE_GROUP", "AZURE_CONTAINER_APP_NAME")
foreach ($name in $variables) {
    $val = [Environment]::GetEnvironmentVariable($name, "Process")
    if ([string]::IsNullOrEmpty($val)) { $val = [Environment]::GetEnvironmentVariable($name, "User") }
    if ([string]::IsNullOrEmpty($val)) { $val = [Environment]::GetEnvironmentVariable($name, "Machine") }
    if ([string]::IsNullOrEmpty($val)) {
        Write-Warning "$name is not set; skipping."
    } else {
        gh variable set $name --body $val
        Write-Host "Set variable: $name"
    }
}

$opt = [Environment]::GetEnvironmentVariable("AZURE_CONTAINER_APPS_ENVIRONMENT", "Process")
if ([string]::IsNullOrEmpty($opt)) { $opt = [Environment]::GetEnvironmentVariable("AZURE_CONTAINER_APPS_ENVIRONMENT", "User") }
if ([string]::IsNullOrEmpty($opt)) { $opt = [Environment]::GetEnvironmentVariable("AZURE_CONTAINER_APPS_ENVIRONMENT", "Machine") }
if (-not [string]::IsNullOrEmpty($opt)) {
    gh variable set AZURE_CONTAINER_APPS_ENVIRONMENT --body $opt
    Write-Host "Set variable: AZURE_CONTAINER_APPS_ENVIRONMENT"
}

Write-Host "Done. Verify at: GitHub repo -> Settings -> Secrets and variables -> Actions"
