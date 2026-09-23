<#
  check-all.ps1 -- run every pre-push check for TravelMasterV2 in one go.

  Usage (from the project root, D:\projects\TravelMasterV2):
      powershell -ExecutionPolicy Bypass -File .\check-all.ps1
      powershell -ExecutionPolicy Bypass -File .\check-all.ps1 -SkipE2E   # skip the browser tests

  It only READS and TESTS -- it never edits, commits or pushes anything.
  Generated files it creates (coverage reports, build output) are all
  gitignored or removed at the end.

  At the end you get one table: PASS / WARN / FAIL per check.
  Exit code 0 = safe to push, 1 = something failed.
#>
param(
    [switch]$SkipE2E
)

$ErrorActionPreference = "Continue"
$Root     = $PSScriptRoot
$Backend  = Join-Path $Root "apps/backend/agent_service"
$Frontend = Join-Path $Root "apps/frontend"
$LogFile  = Join-Path $Root "check-all.log"
$Results  = New-Object System.Collections.Generic.List[object]
$script:LastOutput = @()

"check-all run $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $LogFile -Encoding utf8

function Add-Result($Name, $Status, $Detail) {
    $Results.Add([pscustomobject]@{ Check = $Name; Status = $Status; Detail = $Detail })
    $color = @{ PASS = "Green"; WARN = "Yellow"; FAIL = "Red"; SKIP = "DarkGray" }[$Status]
    Write-Host ("  -> {0}: {1}  {2}" -f $Status, $Name, $Detail) -ForegroundColor $color
}

# Runs a command in a folder, streams output to the log, returns the exit code.
function Invoke-Step($Name, $Dir, [scriptblock]$Command) {
    Write-Host ""
    Write-Host "=== $Name ===  (running... last lines shown when done)" -ForegroundColor Cyan
    "`n=== $Name ===" | Out-File $LogFile -Append -Encoding utf8
    Push-Location $Dir
    try {
        $global:LASTEXITCODE = 0
        # Out-File -Encoding utf8 per line, not Tee-Object: on Windows
        # PowerShell 5.1 Tee-Object writes UTF-16, which garbled the log.
        $script:LastOutput = @(& $Command 2>&1 | ForEach-Object { "$_" })
        $code = $LASTEXITCODE
        $script:LastOutput | Out-File $LogFile -Append -Encoding utf8
        $script:LastOutput | Select-Object -Last 15 | ForEach-Object { Write-Host "   $_" }
    } catch {
        Write-Host "   $_" -ForegroundColor Red
        $_ | Out-File $LogFile -Append -Encoding utf8
        $code = 1
    } finally {
        Pop-Location
    }
    return $code
}

function Test-Tool($Exe) { return [bool](Get-Command $Exe -ErrorAction SilentlyContinue) }

# ---------------------------------------------------------------------
# 0. Tools
# ---------------------------------------------------------------------
Write-Host "TravelMasterV2 pre-push check" -ForegroundColor White
$Py = $null
foreach ($c in @("python", "py", "python3")) { if (Test-Tool $c) { $Py = $c; break } }
foreach ($t in @("git", "node", "npm", "npx")) {
    if (-not (Test-Tool $t)) { Add-Result "Tool: $t" "FAIL" "not found on PATH" }
}
if (-not $Py) { Add-Result "Tool: python" "FAIL" "python / py not found on PATH" }

# ---------------------------------------------------------------------
# 1. Git safety checks (no secrets, no stray local edits)
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "=== Git safety ===" -ForegroundColor Cyan
Push-Location $Root

# Tracked already, or staged / about to be added.
$envTracked = @(git ls-files 2>$null | Where-Object { $_ -match '(^|/)\.env(\.|$)' -and $_ -notmatch '\.env\.example$' })
$envStaged  = @(git status --porcelain 2>$null | ForEach-Object { $_.Substring(3) } |
                Where-Object { $_ -match '(^|/)\.env(\.|$)' -and $_ -notmatch '\.env\.example$' })
$envBad = @($envTracked + $envStaged | Sort-Object -Unique)
if ($envBad.Count -gt 0) {
    Add-Result "No .env files in git" "FAIL" ("remove from git: " + ($envBad -join ", ") + "  (git rm --cached <file>)")
} else {
    Add-Result "No .env files in git" "PASS" "only .env.example files are tracked"
}

git diff --quiet -- apps/backend/agent_service/deploy.py 2>$null
if ($LASTEXITCODE -ne 0) {
    $stat = (git diff --stat -- apps/backend/agent_service/deploy.py | Select-Object -Last 1)
    Add-Result "deploy.py unchanged" "WARN" "modified ($stat). Run: git diff apps/backend/agent_service/deploy.py  -- keep only if intended"
} else {
    Add-Result "deploy.py unchanged" "PASS" ""
}

$mainPy = Join-Path $Backend "main.py"
$debugPrints = @(Select-String -Path $mainPy -Pattern '^print\("\d+:' -ErrorAction SilentlyContinue)
if ($debugPrints.Count -gt 0) {
    Add-Result "No debug prints in main.py" "WARN" "$($debugPrints.Count) lines like print(`"1: dotenv`") -- harmless, but leftovers from debugging"
} else {
    Add-Result "No debug prints in main.py" "PASS" ""
}

$envLocal = Join-Path $Frontend ".env.local"
if ((Test-Path $envLocal) -and (Select-String -Path $envLocal -Pattern 'localhost' -Quiet)) {
    git check-ignore -q -- apps/frontend/.env.local 2>$null
    $ignored = ($LASTEXITCODE -eq 0)
    $inGit = @(git ls-files -- apps/frontend/.env.local 2>$null).Count -gt 0
    if ($ignored -and -not $inGit) {
        Add-Result ".env.local points at localhost" "PASS" "fine -- it's gitignored and never pushed"
    } else {
        Add-Result ".env.local points at localhost" "FAIL" "it is in git -- run: git rm --cached apps/frontend/.env.local"
    }
}
Pop-Location

# ---------------------------------------------------------------------
# 2. Backend (same commands as .github/workflows/backend-ci.yml)
# ---------------------------------------------------------------------
if ($Py) {
    $hadXml = Test-Path (Join-Path $Backend "coverage.xml")
    $hadCov = Test-Path (Join-Path $Backend ".coverage")

    $code = Invoke-Step "Backend: full test suite (except DB)" $Backend { & $Py -m pytest tests -q -p no:warnings --ignore=tests/db }
    if ($code -eq 0) { Add-Result "Backend tests (all except DB)" "PASS" "expect ~175 passed" }
    else { Add-Result "Backend tests (all except DB)" "FAIL" "see check-all.log" }

    & $Py -c "import pytest_cov" 2>$null | Out-Null
    $hasCov = ($LASTEXITCODE -eq 0)
    if ($hasCov) {
        $code = Invoke-Step "Backend: CI test run with coverage" $Backend {
            & $Py -m pytest tests/services/ tests/shared/ tests/api/ -q -p no:warnings `
                --cov=services --cov=shared --cov=api --cov=core --cov-report=xml
        }
        if ($code -eq 0) { Add-Result "Backend CI tests (services/shared/api)" "PASS" "" }
        else { Add-Result "Backend CI tests (services/shared/api)" "FAIL" "see check-all.log" }

        $code = Invoke-Step "Backend: coverage floor (60%)" $Backend {
            & $Py -m coverage report --include="shared/quota_guard.py,core/auth.py,api/payment_routes.py,services/subscription_service.py" --fail-under=60
        }
        if ($code -eq 0) { Add-Result "Backend coverage floor" "PASS" "" }
        else { Add-Result "Backend coverage floor" "FAIL" "below 60% on auth/billing/quota files" }
    } else {
        Add-Result "Backend CI coverage" "WARN" "pytest-cov not installed (pip install -r requirements-dev.txt) -- skipped"
    }

    $code = Invoke-Step "Backend: DB tests" $Backend { & $Py -m pytest tests/db/ -q -p no:warnings }
    $noVector = ($script:LastOutput -join "`n") -match 'extension "vector" is not available'
    if ($code -eq 0 -or $code -eq 5) { Add-Result "Backend DB tests" "PASS" "(skipped locally is normal)" }
    elseif ($noVector) { Add-Result "Backend DB tests" "WARN" "your local Postgres has no pgvector extension -- CI uses pgvector/pgvector:pg16, so these run there" }
    else { Add-Result "Backend DB tests" "FAIL" "see check-all.log" }

    # Tidy up generated coverage files we created (don't leave them to commit).
    # -Force: PowerShell treats dot-files as hidden. .coverage is NOT in
    # .gitignore, so a leftover could otherwise end up in a commit.
    if (-not $hadXml) { Remove-Item (Join-Path $Backend "coverage.xml") -Force -ErrorAction SilentlyContinue }
    if (-not $hadCov) { Remove-Item (Join-Path $Backend ".coverage") -Force -ErrorAction SilentlyContinue }
}

# ---------------------------------------------------------------------
# 3. Frontend (same commands as .github/workflows/frontend-ci.yml)
# ---------------------------------------------------------------------
if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    $code = Invoke-Step "Frontend: npm install (node_modules missing)" $Frontend { npm install --no-audit --no-fund }
    if ($code -ne 0) { Add-Result "Frontend install" "FAIL" "npm install failed" }
}

$leaflet = Join-Path $Frontend "node_modules/leaflet/package.json"
if (Test-Path $leaflet) { Add-Result "Leaflet installed" "PASS" "" }
else { Add-Result "Leaflet installed" "FAIL" "run: npm install leaflet@^1.9.4 ; npm install -D @types/leaflet@^1.9" }

$steps = @(
    @{ Name = "Frontend lint";                  Cmd = { npm run lint } },
    @{ Name = "Frontend type-check (app)";      Cmd = { npx tsc -b tsconfig.app.json --noEmit } },
    @{ Name = "Frontend type-check (tests)";    Cmd = { npx tsc -p tsconfig.test.json --noEmit } },
    @{ Name = "Frontend unit tests + coverage"; Cmd = { npx vitest run --coverage } },
    @{ Name = "Frontend production build";      Cmd = { npm run build } }
)
foreach ($s in $steps) {
    $code = Invoke-Step $s.Name $Frontend $s.Cmd
    if ($code -eq 0) { Add-Result $s.Name "PASS" "" } else { Add-Result $s.Name "FAIL" "see check-all.log" }
}

if ($SkipE2E) {
    Add-Result "Frontend e2e (Playwright)" "SKIP" "-SkipE2E given"
} else {
    $code = Invoke-Step "Frontend e2e (Playwright, starts its own dev server)" $Frontend { npx playwright test --reporter=line }
    if ($code -eq 0) { Add-Result "Frontend e2e (Playwright)" "PASS" "" }
    else { Add-Result "Frontend e2e (Playwright)" "FAIL" "if it says 'browser not installed', run once: npx playwright install chromium" }
}

# ---------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "==================== SUMMARY ====================" -ForegroundColor White
$Results | Format-Table -AutoSize -Wrap | Out-String -Width 200 | Write-Host
$Results | Format-Table -AutoSize -Wrap | Out-String -Width 200 | Out-File $LogFile -Append -Encoding utf8

$fails = @($Results | Where-Object Status -eq "FAIL").Count
$warns = @($Results | Where-Object Status -eq "WARN").Count
if ($fails -gt 0) {
    Write-Host "RESULT: $fails FAILED, $warns warning(s). Do NOT push yet -- full output is in check-all.log" -ForegroundColor Red
    exit 1
} elseif ($warns -gt 0) {
    Write-Host "RESULT: all checks passed, $warns warning(s) to glance at (see table). OK to push once you're happy with them." -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "RESULT: everything passed. Safe to push." -ForegroundColor Green
    exit 0
}