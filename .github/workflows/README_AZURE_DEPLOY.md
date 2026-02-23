# Azure deployment – ENOTFOUND fix

## Error you saw

```text
getaddrinfo ENOTFOUND videoconsultation-fsb6dbejh3c9htfn.scm.canadacentral-01.azurewebsites.net
Failed to deploy web package to App Service.
```

This means the deployment is trying to connect to an Azure Web App whose hostname **no longer resolves** (app deleted, renamed, or publish profile is for a different/wrong app).

## You have two workflows

| Workflow file | Deploys to app name | Region (from error) |
|---------------|---------------------|---------------------|
| `master_kauveryteleconsultation.yml` | **kauveryteleconsultation** | South India (your live URL) |
| `mater_videoconsultation.yml`        | **videoconsultation**       | Canada Central      |

The failing one is **videoconsultation** (workflow `mater_videoconsultation.yml`).  
So either that app doesn’t exist anymore, or the GitHub secret for its publish profile is wrong/outdated.

## Fix options

### Option A – You only use kauveryteleconsultation (South India)

- **Disable the videoconsultation workflow** so it doesn’t run on push:
  - Rename: `mater_videoconsultation.yml` → `mater_videoconsultation.yml.disabled`
  - Or delete: `.github/workflows/mater_videoconsultation.yml`
- Pushes to `master` will then only run `master_kauveryteleconsultation.yml` and deploy to **kauveryteleconsultation** (no ENOTFOUND for that app).

### Option B – You want to deploy to videoconsultation (Canada Central)

1. **Check the app exists**
   - Azure Portal → App Services → find an app named **videoconsultation** (or the exact name that matches your setup).
   - If it doesn’t exist, create it in the right resource group and region (e.g. Canada Central), or use a different app name and update the workflow (see below).

2. **Refresh the publish profile and GitHub secret**
   - In Azure Portal: open that Web App → **Get publish profile** (or **Deployment Center** → **Manage publish profile**).
   - Download the **.PublishSettings** file.
   - In GitHub: **Settings → Secrets and variables → Actions**.
   - Find the secret used in `mater_videoconsultation.yml`:  
     `AZUREAPPSERVICE_PUBLISHPROFILE_683A7966C1874238A8C424F82AE776B9`
   - Update that secret with the **full contents** of the new publish profile file (so the SCM URL in the secret matches the current app hostname).

3. **If your app name is different**
   - In the workflow, set `app-name` to the **exact** Web App name from Azure (e.g. `videoconsultation-fsb6dbejh3c9htfn` if that’s the real name).
   - The publish profile must still be for that same app (so the hostname inside the profile matches the app).

### Option C – One app, one workflow

- If you only ever deploy to **kauveryteleconsultation**, keep only `master_kauveryteleconsultation.yml` and disable/remove `mater_videoconsultation.yml` (Option A). Then “make build” / push to master will only deploy to the South India app and you won’t see this ENOTFOUND anymore.

## Summary

- **ENOTFOUND** = the hostname in the publish profile (for **videoconsultation**, Canada Central) is not resolvable. Fix by either:
  - Stopping use of that workflow (disable/delete `mater_videoconsultation.yml`), or  
  - Making sure the **videoconsultation** app exists and the GitHub publish profile secret matches that app’s current publish profile.

Also: the workflow filename has a typo (**mater** instead of **master**). Renaming to `master_videoconsultation.yml` doesn’t fix ENOTFOUND but keeps naming consistent.
