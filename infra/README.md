# RailSignal Infrastructure (Terraform)

All Azure cloud infrastructure is defined as code using Terraform under the £0 monthly free consumption grant.

## Provisioned Resources
1. **Azure Resource Group** (`rg-railsignal-prod`)
2. **Log Analytics Workspace** (`law-railsignal-prod`): 30-day retention for console stdout/stderr logs.
3. **Application Insights** (`appi-railsignal-prod`): APM and distributed tracing.
4. **Azure Container App Environment** (`cae-railsignal-prod`): Serverless managed environment in `uksouth`.
5. **Azure Container App** (`railsignal-api`):
   - Fastify HTTP API + BullMQ Workers running unified inside Node.js 22 LTS Alpine.
   - Scale-to-zero enabled: `min_replicas = 0`, `max_replicas = 1`.
   - Ingress: Port 3000, external HTTPS.
6. **Azure Container App Job** (`railsignal-sync-job`):
   - Scheduled cron job running `node dist/jobs/syncDisruptionsRunner.js` every Friday at 09:00 UK time.
7. **Azure Static Web App** (`swa-railsignal-prod`):
   - Free tier host for the React 19 SPA frontend client.

## Remote State Management
State is persisted in Azure Blob Storage:
- Resource Group: `rg-railsignal-tfstate`
- Storage Account: `strailsignaltf`
- Container: `tfstate`
- Blob: `railsignal.terraform.tfstate`
- Authentication: Azure OIDC (`use_oidc = true`)

## Automated CI/CD
GitHub Actions workflow `.github/workflows/infra.yml` executes:
- `terraform plan` on Pull Requests.
- `terraform apply` on pushes to `main`.
