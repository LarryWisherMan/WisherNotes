---
id: appendix-k
title: Appendix K – Idempotency and Error Handling
sidebar_position: 11
description: Designing safe retryable operations and consistent state management.
---

> “Reliable automation is not about avoiding failure — it’s about designing for it.”

This appendix focuses on **idempotency** and **error handling**, two of the most critical principles for production-ready automation.
Together, they ensure your PowerShell modules behave **predictably**, **safely**, and **recoverably** — even in imperfect environments.

---

## K.1 What Is Idempotency?

In simple terms:
> **An idempotent operation can be run multiple times without changing the result beyond the first application.**

For automation, this means that re-running your function:
- Should not create duplicates.
- Should not corrupt state.
- Should produce consistent results.

### Example: Idempotent vs Non-Idempotent

```powershell
# ❌ Not idempotent: creates duplicates each time
function Add-UserRecord {
    Add-Content -Path "users.txt" -Value "John"
}

# ✅ Idempotent: checks before acting
function Add-UserRecord {
    if (-not (Select-String -Path "users.txt" -Pattern "John")) {
        Add-Content -Path "users.txt" -Value "John"
    }
}
```

> **Rule:** Every mutator (`New-`, `Set-`, `Remove-`, `Enable-`, `Disable-`) should be idempotent.

---

## K.2 Why Idempotency Matters

| Problem | Without Idempotency | With Idempotency |
|----------|--------------------|------------------|
| Retry loops | Creates duplicates | Safely repeats |
| Parallel execution | Race conditions | Consistent results |
| Error recovery | Requires cleanup | Self-healing |
| CI/CD pipelines | Unreliable | Repeatable runs |

Idempotency allows scripts to be *safe to re-run*.
It’s foundational for declarative infrastructure, configuration management, and reliable DevOps pipelines.

---

## K.3 Levels of Idempotency

1. **Functional Idempotency** — The function itself ensures consistency via internal logic.
   Example: skip creation if already exists.

2. **System Idempotency** — The system state remains stable regardless of re-invocation.
   Example: API ignores duplicate `POST` requests for existing entities.

3. **Contract Idempotency** — The function’s interface guarantees predictable output and no side effects.
   Example: `Set-ServerMode` always returns the current mode, not an action status.

---

## K.4 Designing for Idempotency

### Key Design Rules

| Rule | Description | Example |
|------|--------------|----------|
| **Check before act** | Query current state before mutation | `if (-not (Test-Path $Path)) { New-Item $Path }` |
| **Use test helpers** | Encapsulate “should I change?” logic | `Test-ServerInMaintenanceMode` |
| **Return consistent output** | Always return the same object shape | `[PSCustomObject]@{ Name=$Name; Changed=$false }` |
| **Avoid timestamps as identifiers** | Use deterministic naming | Avoid `New-Guid()` for repeatable objects |
| **Implement safe retries** | Combine with error handling | Use `Invoke-Retry` with idempotent logic |

### Example: Idempotent File Creator

```powershell
function New-FileSafe {
    [CmdletBinding(SupportsShouldProcess)]
    param([string]$Path)

    if (Test-Path $Path) {
        Write-Verbose "File already exists: $Path"
        return Get-Item $Path
    }

    if ($PSCmdlet.ShouldProcess($Path, 'Create file')) {
        New-Item -Path $Path -ItemType File | Out-Null
        Get-Item $Path
    }
}
```

---

## K.5 Error Handling Philosophy

PowerShell provides a robust but nuanced error system.
Engineering discipline means using it *intentionally*, not incidentally.

### Types of Errors
| Type | Description | Example | Handling |
|------|--------------|----------|-----------|
| **Terminating** | Stops execution | `throw` | Use for unrecoverable states |
| **Non-Terminating** | Allows continuation | `Write-Error` | Use for partial failures |
| **Handled** | Caught in `try/catch` | `catch { ... }` | Log, retry, or recover gracefully |

---

## K.6 The Error Handling Layers

| Layer | Responsibility |
|--------|----------------|
| **Core** | Implement retry & error wrappers (`Invoke-Safely`, `Invoke-Retry`) |
| **Domain** | Throw logic errors (invalid inputs, bad state) |
| **Adapter** | Catch and contextualize system/REST errors |
| **Context** | Present errors to users or logs, never raw exceptions |

Example:
```
Find-Server (Context)
│
├─ Invoke-ProviderRequest (Adapter) → catches 404, wraps “Server not found”
│
└─ ConvertTo-ServerRecord (Domain) → validates properties, throws for malformed data
```

---

## K.7 Retry Pattern (Resilient Execution)

Retries make transient operations reliable — *but only when combined with idempotency.*

### Example Implementation

```powershell
function Invoke-Retry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][scriptblock]$Action,
        [int]$Attempts = 3,
        [int]$DelaySeconds = 2
    )

    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            return & $Action
        }
        catch {
            Write-Warning "Attempt $i failed: $($_.Exception.Message)"
            if ($i -lt $Attempts) { Start-Sleep -Seconds $DelaySeconds }
            else { throw }
        }
    }
}
```

> Retry logic belongs in Core utilities — so it’s consistent across modules.

---

## K.8 Defensive Error Design

### Use `SupportsShouldProcess`
All mutators should declare `[CmdletBinding(SupportsShouldProcess)]`.

```powershell
if ($PSCmdlet.ShouldProcess($Target, 'Perform Update')) {
    # Execute change
}
```

This ensures safe dry runs (`-WhatIf`) and user confirmations.

### Never Hide Failures
- Catch only what you can handle.
- Rethrow (`throw $_`) after logging context.
- Don’t swallow errors silently.

---

## K.9 Example: Safe Server Update

This example demonstrates both idempotency and robust error handling.

```powershell
function Set-ServerMode {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [string]$Server,
        [ValidateSet('Online','Maintenance')]
        [string]$Mode
    )

    try {
        $current = Get-ServerMode -Server $Server
        if ($current -eq $Mode) {
            Write-Verbose "Server '$Server' already in mode '$Mode'."
            return [PSCustomObject]@{ Server=$Server; Changed=$false }
        }

        if ($PSCmdlet.ShouldProcess($Server, "Change mode to $Mode")) {
            Invoke-Safely -Action {
                # External call, may fail
                Set-RemoteServerMode -Server $Server -Mode $Mode
            }
            return [PSCustomObject]@{ Server=$Server; Changed=$true }
        }
    }
    catch {
        Write-Error "Failed to set mode for $Server: $($_.Exception.Message)"
        throw
    }
}
```

### What Makes It Good
- Checks current state first → idempotent.
- Supports `-WhatIf` → safe.
- Wraps risky call with `Invoke-Safely` → resilient.
- Returns structured output → predictable contract.

---

## K.10 Testing for Idempotency

Add Pester tests that simulate repeated runs:

```powershell
Describe 'Set-ServerMode Idempotency' {
    It 'does not reapply when state is unchanged' {
        $r1 = Set-ServerMode -Server 'App01' -Mode 'Online'
        $r2 = Set-ServerMode -Server 'App01' -Mode 'Online'
        $r2.Changed | Should -BeFalse
    }
}
```

> If re-running a function changes nothing, you’ve achieved idempotency.

---

## K.11 Checklist

| Rule | Purpose |
|------|----------|
| Always check before act | Prevent duplicates |
| Make mutators idempotent | Enables retries and CI/CD |
| Use `Invoke-Retry` for transient ops | Resilience |
| Use structured errors and logs | Clarity |
| Support `-WhatIf` | Safety |
| Never silence exceptions | Transparency |

---

## K.12 Summary

| Concept | Takeaway |
|----------|-----------|
| Idempotency | Repeatable and safe automation |
| Error Handling | Fail predictably, recover gracefully |
| Retry Logic | Reliability under imperfect conditions |
| Layered Responsibility | Core retries, Adapters wrap, Context reports |
| Testing | Ensure re-runs are harmless |

> Resilient automation is not about perfection — it’s about being **safe to run twice.**

---

**End of Appendix K**
