# Deploy Playground to Azure

This doc describes one-time setup so the **Deploy playground to Azure** workflow can build the playground image and deploy it to your Azure subscription (Azure Container Apps + Azure Container Registry).

## Overview

- **Workflow:** [Azure deploy workflow](../.github/workflows/deploy-playground-azure.yml)
- **Triggers:** Push to `main`/`master` that touches playground/server/Dockerfiles or `workflow_dispatch`.
- **Steps:** Checkout → Azure login (OIDC) → Build image from `Dockerfile.playground` → Push to ACR → Deploy/update Container App.

## 1. Azure resources

Create (once) in your subscription:

- **Register Container Apps provider** (required once per subscription)
- **Resource group** (e.g. `truthlayer-rg`)
- **Azure Container Registry** (ACR, e.g. `truthlayeracr`)
- **Container Apps environment** (e.g. `truthlayer-env`)
- **Container App** (e.g. `truthlayer-playground`) in that environment, with **ingress external** and **target port 80** (the app listens on `PORT`, which Azure sets to 80)

### 1a. Register Microsoft.App (Container Apps) provider

If your subscription has never used Container Apps, register the provider first (one-time; can take a few minutes):

```bash
az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"
az provider register -n Microsoft.App --wait
```

Check when registration is complete:

```bash
az provider show -n Microsoft.App --query "registrationState" -o tsv
# Should print: Registered
```

### 1b. Create resource group, ACR, environment, and Container App

Example (Azure CLI):

```bash
az group create --name truthlayer-rg --location eastus
az acr create --resource-group truthlayer-rg --name truthlayeracr --sku Basic --admin-enabled false
az containerapp env create --name truthlayer-env --resource-group truthlayer-rg --location eastus
az containerapp create \
  --name truthlayer-playground \
  --resource-group truthlayer-rg \
  --environment truthlayer-env \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 80 \
  --ingress external
```

Then configure the app to pull from your ACR using **managed identity** (recommended):

1. Enable system-assigned managed identity on the Container App.
2. Grant that identity **AcrPull** on the ACR.
3. Set the registry on the Container App to use the managed identity:

```bash
# After creating the container app:
PRINCIPAL_ID=$(az containerapp show --name truthlayer-playground --resource-group truthlayer-rg --query identity.principalId -o tsv)
ACR_ID=$(az acr show --name truthlayeracr --resource-group truthlayer-rg --query id -o tsv)
az role assignment create --assignee "$PRINCIPAL_ID" --role AcrPull --scope "$ACR_ID"
az containerapp registry set \
  --name truthlayer-playground \
  --resource-group truthlayer-rg \
  --server truthlayeracr.azurecr.io \
  --identity system
```

The first deploy from GitHub will replace the placeholder image with your built image.

## 2. GitHub: OIDC (recommended)

Use OpenID Connect so the workflow can sign in to Azure without storing a client secret.

### 2a. App registration and federated credential

1. **Microsoft Entra ID** → **App registrations** → **New registration** (e.g. name: `github-truthlayer-deploy`).
   - **Supported account types:** leave as **Accounts in this organizational directory only** (single-tenant). Multi-tenant is not needed—only your tenant’s subscription is accessed.
   - **Redirect URI:** leave empty. OIDC with federated credentials does not use redirects (no browser sign-in).
2. Note **Application (client) ID** and **Directory (tenant) ID**.
3. **Certificates & secrets** → **Federated credentials** → **Add**:
   - **Federated credential scenario:** GitHub Actions deploying Azure resources
   - **Organization:** your GitHub org (or leave blank for personal repo)
   - **Repository:** `your-org/context-first-docs` (or your repo name)
   - **Entity type:** Branch
   - **GitHub branch name:** `main` (or `master`)
   - **Name:** e.g. `main-branch`

### 2b. Grant the app access to the resource group

The app needs **Contributor** (or at least ability to push to ACR and update the Container App) on the resource group:

```bash
az role assignment create \
  --assignee "<APPLICATION_CLIENT_ID>" \
  --role Contributor \
  --scope "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/truthlayer-rg"
```

### 2c. GitHub secrets and variables

You can set them in the GitHub UI, or use the GitHub CLI from your machine (no secrets in the repo):

**Option A: Script (requires [GitHub CLI](https://cli.github.com/) installed and `gh auth login`)**

If PowerShell blocks the script, allow scripts for the current user (one-time):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

From the repo root, set environment variables then run:

```powershell
# PowerShell (Windows)
$env:AZURE_CLIENT_ID = "<your-client-id>"
$env:AZURE_TENANT_ID = "<your-tenant-id>"
$env:AZURE_SUBSCRIPTION_ID = "<your-subscription-id>"
$env:AZURE_ACR_NAME = "truthlayeracr"
$env:AZURE_RESOURCE_GROUP = "truthlayer-rg"
$env:AZURE_CONTAINER_APP_NAME = "truthlayer-playground"
.\scripts\set-github-azure-secrets.ps1
```

```bash
# Bash (Linux/macOS/WSL)
export AZURE_CLIENT_ID="<your-client-id>"
export AZURE_TENANT_ID="<your-tenant-id>"
export AZURE_SUBSCRIPTION_ID="<your-subscription-id>"
export AZURE_ACR_NAME="truthlayeracr"
export AZURE_RESOURCE_GROUP="truthlayer-rg"
export AZURE_CONTAINER_APP_NAME="truthlayer-playground"
./scripts/set-github-azure-secrets.sh
```

**Option B: GitHub UI**

**Secrets** (Settings → Secrets and variables → Actions):

| Secret                  | Value                      |
| ----------------------- | -------------------------- |
| `AZURE_CLIENT_ID`       | Application (client) ID    |
| `AZURE_TENANT_ID`       | Directory (tenant) ID      |
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID |

**Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable                   | Example                 | Description               |
| -------------------------- | ----------------------- | ------------------------- |
| `AZURE_ACR_NAME`           | `truthlayeracr`         | ACR name (no .azurecr.io) |
| `AZURE_RESOURCE_GROUP`     | `truthlayer-rg`         | Resource group name       |
| `AZURE_CONTAINER_APP_NAME` | `truthlayer-playground` | Container App name        |

The workflow runs only when these three variables are set (non-empty).

## 3. Alternative: service principal (AZURE_CREDENTIALS)

If you prefer a client secret instead of OIDC:

1. Create a service principal with Contributor on the resource group:

   ```bash
   az ad sp create-for-rbac \
     --name github-truthlayer-deploy \
     --role contributor \
     --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/truthlayer-rg \
     --sdk-auth
   ```

2. Copy the JSON output and add it as a GitHub secret named **`AZURE_CREDENTIALS`**.

3. Change the workflow’s Azure login step to:

   ```yaml
   - name: Azure login (service principal)
     uses: azure/login@v2
     with:
       creds: ${{ secrets.AZURE_CREDENTIALS }}
   ```

4. Remove or leave unused the OIDC-only permissions; keep `contents: read`.

## 4. Run the workflow

- **Automatic:** Push to `main`/`master` that changes playground/server or the workflow file.
- **Manual:** Actions → **Deploy playground to Azure** → **Run workflow**.

After a successful run, the app is available at the Container App’s URL (e.g. `https://truthlayer-playground.<unique>.azurecontainerapps.io`).

## 5. HTTP vs HTTPS

**Default:** Azure Container Apps serves **HTTPS only** on the default URL. HTTP requests are automatically redirected to HTTPS (TLS 1.2+). The default `*.azurecontainerapps.io` host uses an Azure-managed certificate, so HTTPS works without extra configuration.

**If you need to allow HTTP** (plain, unencrypted) as well—e.g. for local/dev or a reverse proxy that terminates TLS elsewhere—set the ingress property `allowInsecure: true`:

- **Portal:** Container App → **Ingress** → enable **Allow insecure connections (HTTP)**.
- **CLI:**
  ```bash
  az containerapp ingress update \
    --name truthlayer-playground \
    --resource-group truthlayer-rg \
    --allow-insecure true
  ```

Recommendation: keep the default (HTTPS only) for production; use HTTP only when necessary (e.g. internal or dev).

## 6. Optional: Container Apps environment name

If your Container App is in an environment with a different name than the default, set the variable **`AZURE_CONTAINER_APPS_ENVIRONMENT`** and use it in the deploy action’s `containerAppEnvironment` input (you’d add that input to the workflow and set it to `vars.AZURE_CONTAINER_APPS_ENVIRONMENT`).

## Troubleshooting

- **"Subscription is not registered for the Microsoft.App resource provider"**  
  The deploy step fails when the subscription has never used Container Apps. Fix: run the one-time registration in [§1a](#1a-register-microsoftapp-container-apps-provider) (`az provider register -n Microsoft.App --wait`), then re-run the workflow.

- **"TargetPort 4317 does not match the listening port 80" / container crashing**  
  Azure Container Apps sets `PORT=80` for ingress; the app listens on that port. The workflow and Container App must use **target port 80**. If you created the app with target port 4317, update it:  
  `az containerapp ingress update --name truthlayer-playground --resource-group truthlayer-rg --target-port 80`  
  Then re-run the deploy workflow (or the next deploy will set target port 80).

- **"Failed to retrieve credentials for container registry. Please provide the registry username and password"**  
  The deploy action (or the Container App when pulling the image) cannot authenticate to ACR. Use ACR admin credentials:
  1. **Enable admin user** on the registry (Azure Portal → ACR → **Access keys** → Enable Admin user), or:
     ```bash
     az acr update --name <ACR_NAME> --resource-group truthlayer-rg --admin-enabled true
     ```
  2. **Get username and password:**  
     Azure Portal → ACR → **Access keys** → copy **Login server** (use as username for ACR: it’s often the ACR name, e.g. `truthlayeracr`) and **Username** / **Password** (use the values shown there; username is often the ACR name).
  3. **Add GitHub secrets** (repo **Settings** → **Secrets and variables** → **Actions**):
     - `AZURE_ACR_USERNAME` = ACR username (e.g. `truthlayeracr`)
     - `AZURE_ACR_PASSWORD` = ACR password (from Access keys)
  4. Re-run the deploy workflow. The workflow uses these secrets for pushing the image to ACR.

  Ensure the Container App can **pull** from ACR: either keep **managed identity** with AcrPull and `az containerapp registry set --identity system`, or add the same ACR credentials to the Container App (Container App → **Registry** → add registry with username/password).

- **Default / “Welcome” page instead of the Playground**  
  The app is still running the **placeholder image** (e.g. `containerapps-helloworld`), not the built TruthLayer image. In the Azure Portal, open the Container App → **Revision management**: confirm the **active** revision uses an image like `truthlayeracr.azurecr.io/truthlayer-playground:<sha>`. If a new revision has the correct image but **0% traffic**, set traffic to it (e.g. **Ingress** → send 100% to the latest revision). You can also run:  
  If the app is in **single revision mode**, switch to **multiple** first, then set traffic:

  ```bash
  az containerapp revision set-mode --name truthlayer-playground --resource-group truthlayer-rg --mode multiple
  az containerapp ingress traffic set --name truthlayer-playground --resource-group truthlayer-rg --revision-weight latest=100
  ```

  To confirm our app is serving: open `https://<your-app-url>/api/scenarios`; a JSON list means the playground is running.

- **Image built and pushed but live app not updated**  
  The deploy workflow now includes a **"Send traffic to latest revision"** step so each deploy sends 100% traffic to the new revision. If a past run built the image but the site still showed the old version, run the workflow again (push to `main` or **Actions** → **Deploy playground to Azure** → **Run workflow**), or fix the current app with the same commands as above (`revision set-mode` then `ingress traffic set ... latest=100`). Check **Revision management** in the portal to see which revision has the new image and which has traffic.
