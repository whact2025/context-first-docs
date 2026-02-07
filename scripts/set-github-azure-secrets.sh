#!/usr/bin/env bash
# Set GitHub Actions secrets and variables for Azure deploy from environment variables.
# Requires: GitHub CLI (gh) installed and authenticated (gh auth login).
# Usage:
#   export AZURE_CLIENT_ID="..."
#   export AZURE_TENANT_ID="..."
#   export AZURE_SUBSCRIPTION_ID="..."
#   export AZURE_ACR_NAME="truthlayeracr"
#   export AZURE_RESOURCE_GROUP="truthlayer-rg"
#   export AZURE_CONTAINER_APP_NAME="truthlayer-playground"
#   ./scripts/set-github-azure-secrets.sh
# Or: source a .env file you don't commit, then run this script.

set -e

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) is required. Install from https://cli.github.com/ and run 'gh auth login'."
  exit 1
fi

# Secrets (required for OIDC)
for name in AZURE_CLIENT_ID AZURE_TENANT_ID AZURE_SUBSCRIPTION_ID; do
  val="${!name}"
  if [ -z "$val" ]; then
    echo "Warning: $name is not set; skipping."
  else
    echo "$val" | gh secret set "$name"
    echo "Set secret: $name"
  fi
done

# Variables (required for deploy workflow)
for name in AZURE_ACR_NAME AZURE_RESOURCE_GROUP AZURE_CONTAINER_APP_NAME; do
  val="${!name}"
  if [ -z "$val" ]; then
    echo "Warning: $name is not set; skipping."
  else
    gh variable set "$name" --body "$val"
    echo "Set variable: $name"
  fi
done

# Optional
if [ -n "$AZURE_CONTAINER_APPS_ENVIRONMENT" ]; then
  gh variable set AZURE_CONTAINER_APPS_ENVIRONMENT --body "$AZURE_CONTAINER_APPS_ENVIRONMENT"
  echo "Set variable: AZURE_CONTAINER_APPS_ENVIRONMENT"
fi

echo "Done. Verify at: GitHub repo -> Settings -> Secrets and variables -> Actions"
