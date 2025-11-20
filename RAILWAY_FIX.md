# Railway Configuration Fix for lens-api Service

## Problem

The creative endpoints (`/api/v1/creative/random`, `/api/v1/creative/journey`, etc.) are returning 404 errors even though they exist in the codebase.

## Root Cause

The Railway lens-api service is using the wrong configuration:
- **Current**: Uses `railway.json` which runs the Discord bot (`honcho start -f Procfile.honcho`)
- **Needed**: Should use settings from `railway.lens.json` which runs the API (`python lens_search_api.py`)

## Verification

The code is correct and up-to-date:
- ✅ lens_search_api.py contains all creative endpoints (commit 2325ced)
- ✅ Code is pushed to GitHub (main branch)
- ✅ Creative endpoints exist at lines 1174-1455 in lens_search_api.py
- ❌ Railway service is configured to run the bot instead of the API

## Solution: Update Railway Dashboard Settings

### Step 1: Access Railway Dashboard

1. Go to https://railway.app/
2. Navigate to the XULFbot project
3. Select the **lens-api** service (NOT the Xulfbot service)

### Step 2: Update Service Settings

In the lens-api service settings, configure:

**Builder Settings**:
- Builder: **NIXPACKS** (not Dockerfile)
- Build Command: (leave default or set to `pip install -r requirements.txt`)

**Deploy Settings**:
- Start Command: **`python lens_search_api.py`**
- Restart Policy: ON_FAILURE
- Max Retries: 10

**Environment Variables** (verify these exist):
- `PORT`: 8080 (or let Railway auto-detect)
- Any Supabase/Pinecone keys needed by lens_search_api.py

### Step 3: Trigger Redeploy

1. Click "Deploy" or "Redeploy" in the Railway dashboard
2. Watch the deployment logs to verify it runs `python lens_search_api.py`
3. Wait for deployment to complete (health check should pass)

### Step 4: Verify Fix

Test the creative endpoints:

```bash
# Should return a random lens provocation (not 404)
curl https://lens-api.up.railway.app/api/v1/creative/random

# Should return a conceptual journey (not 404)
curl "https://lens-api.up.railway.app/api/v1/creative/journey?source=Systems%20Thinking&target=Innovation"
```

Or use the CLI:

```bash
linsenkasten random
linsenkasten journey "Systems Thinking" "Innovation"
```

## Why This Happened

The xulfbot repository contains **two Railway services**:
1. **Xulfbot** - Discord bot (uses railway.json → Procfile.honcho → bot)
2. **lens-api** - Lens search API (should use railway.lens.json → lens_search_api.py)

Railway defaults to `railway.json` for all services, but each service needs its own configuration. The lens-api service needs to be explicitly configured in the dashboard to use the correct start command.

## Alternative Solution (Not Recommended)

If dashboard configuration doesn't work, we could:
1. Create a separate branch for lens-api deployment
2. On that branch, rename `railway.lens.json` to `railway.json`
3. Configure lens-api service to deploy from that branch

However, this is more complex and the dashboard configuration should work.

## Expected Behavior After Fix

✅ `/api/v1/lenses/search` - Works (basic endpoints)
✅ `/api/v1/creative/random` - Should work after fix
✅ `/api/v1/creative/journey` - Should work after fix
✅ `/api/v1/creative/bridges` - Should work after fix
✅ `/api/v1/creative/contrasts` - Should work after fix
✅ `/api/v1/creative/central` - Should work after fix
✅ `/api/v1/creative/neighborhood` - Should work after fix

All CLI commands should work:
- `linsenkasten random` ✅
- `linsenkasten journey "A" "B"` ✅
- `linsenkasten bridge "A" "B" "C"` ✅
- `linsenkasten central` ✅
- `linsenkasten neighborhood "A"` ✅
- `linsenkasten contrasts "A"` ✅

## Files Reference

**In ~/xulfbot**:
- `railway.json` - Bot config (currently being used by lens-api - WRONG)
- `railway.lens.json` - API config (should be used by lens-api - CORRECT)
- `lens_search_api.py` - The API server with creative endpoints

**Configuration to Use**:
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "python lens_search_api.py",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Next Steps

1. Update Railway dashboard with correct configuration
2. Redeploy lens-api service
3. Test creative endpoints
4. If working, update this document with success confirmation
5. Consider adding health check endpoint: `/api/v1/health` or `/api/v1/lenses/stats`
