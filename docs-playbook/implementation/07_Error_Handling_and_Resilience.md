---
id: error-handling-and-resilience
title: Error Handling and Resilience
sidebar_position: 7
description: Structured exception handling, retry logic, and defensive coding practices.
---

> “You can’t prevent every failure, but you can design so failure doesn’t stop you.”

This chapter teaches how to design PowerShell functions and modules that **fail predictably**, recover gracefully, and log meaningfully.
Resilience isn’t just about “catching errors” — it’s about building systems that communicate clearly when things go wrong.

---

## 7.1 Why Resilience Matters

Every production environment fails sometimes — network timeouts, authentication issues, or API limits.
Unstructured error handling can cause cascading failures or silent data loss.

Resilient PowerShell code is:
- **Transparent:** Failures are reported clearly and consistently.
- **Contained:** One failed operation doesn’t crash the whole run.
- **Recoverable:** Functions can retry, skip, or resume safely.
- **Auditable:** Errors are logged with enough context to debug later.

Without resilience, automation cannot be trusted — even if it works “most of the time.”

---

## 7.2 PowerShell Error Model (Overview)

PowerShell distinguishes between **terminating** and **non-terminating** errors.

| Type | Description | Example | Behavior |
|------|--------------|----------|-----------|
| **Terminating** | Stops execution of the current pipeline or script | `throw`, `-ErrorAction Stop` | Must be handled with `try/catch` |
| **Non-Terminating** | Reports an error but continues | `Write-Error` | Can be filtered with `-ErrorAction` |

### Example
```powershell
try {
    Invoke-RestMethod -Uri $Uri -ErrorAction Stop
}
catch {
    Write-Error "Failed to reach API: $($_.Exception.Message)"
}
```

PowerShell’s native model supports layered resilience: you can catch, suppress, or escalate errors as needed.

---

## 7.3 Choosing the Right Error Type

| Situation | Action | Reason |
|------------|---------|--------|
| Bad input or missing parameter | `throw` | Immediate termination — user fix required |
| Network failure or retryable issue | `Write-Error` + retry | Non-fatal, can continue or recover |
| Optional step fails | `Write-Warning` | Inform but continue |
| Long-running operation progress | `Write-Progress` | Visual feedback, not error-related |

Correctly classifying errors keeps the module stable and predictable.

---

## 7.4 Structured Error Handling Pattern

The standard pattern for resilient functions:

```powershell
function Invoke-ApiRequest {
    [CmdletBinding()]
    param([string]$Uri)

    try {
        Invoke-RestMethod -Uri $Uri -ErrorAction Stop
    }
    catch [System.Net.WebException] {
        Write-Warning "Network issue contacting $Uri: $($_.Exception.Message)"
    }
    catch {
        Write-Error "Unexpected error: $($_.Exception.Message)"
    }
    finally {
        Write-Verbose "Request completed at $(Get-Date -Format o)"
    }
}
```

### Key Practices
- Use **typed catches** for predictable recovery (`[System.IO.IOException]`, `[System.Net.WebException]`).
- Always include context in error messages.
- Avoid exposing secrets or credentials in logs.

---

## 7.5 Defensive Patterns for Common Failures

### 7.5.1 Network Failures
Use retries and backoff:

```powershell
function Invoke-WithRetry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][scriptblock]$Action,
        [int]$Attempts = 3,
        [int]$DelaySec = 5
    )

    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            return & $Action
        }
        catch {
            if ($i -eq $Attempts) { throw }
            Write-Warning "Attempt $i failed; retrying in $DelaySec seconds..."
            Start-Sleep -Seconds $DelaySec
        }
    }
}
```

This pattern can wrap adapter functions like `Invoke-NtxRequest` or `Invoke-ComputeRestRequest`.

---

### 7.5.2 Input Validation Failures

Validate early, fail fast:
```powershell
if (-not $Name) {
    throw "Parameter -Name is required and cannot be empty."
}
```

This prevents wasted processing or confusing downstream errors.

---

### 7.5.3 External System Errors

When APIs return predictable HTTP codes:
```powershell
$response = Invoke-RestMethod -Uri $Uri -ErrorAction Stop
switch ($response.statusCode) {
    200 { return $response }
    404 { Write-Warning "Item not found." }
    500 { throw "Server error encountered on remote API." }
}
```

---

## 7.6 Graceful Degradation

A resilient function can **continue operation** even if part of its work fails.

Example:
```powershell
function Get-MultiServerStatus {
    [CmdletBinding()]
    param([string[]]$Servers)

    foreach ($server in $Servers) {
        try {
            Test-Connection -ComputerName $server -Count 1 -ErrorAction Stop | Out-Null
            [PSCustomObject]@{ Server = $server; Online = $true }
        }
        catch {
            Write-Warning "Server '$server' is unreachable."
            [PSCustomObject]@{ Server = $server; Online = $false }
        }
    }
}
```

This produces structured, usable results even when some items fail.

---

## 7.7 Logging and Observability

Logging should communicate *what happened*, not just *that it happened*.

### Basic Example
```powershell
function Write-Log {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Message,
        [ValidateSet('Info','Warning','Error')][string]$Level = 'Info'
    )

    $timestamp = (Get-Date).ToString('u')
    Write-Verbose "[$timestamp][$Level] $Message"
}
```

### Recommendations
| Type | Stream | Use |
|------|---------|-----|
| Informational | `Write-Verbose` | Internal progress |
| Warning | `Write-Warning` | Non-critical issues |
| Error | `Write-Error` | Failures to diagnose |
| Output | `Write-Output` | Actual results |

Structured logs (JSON, CSV) can also be emitted for automation monitoring.

---

## 7.8 Timeout and Cancellation Handling

For long-running or remote operations, respect timeouts and user cancellation.

### Example
```powershell
$job = Start-Job -ScriptBlock { Invoke-RestMethod $Uri }
Wait-Job -Job $job -Timeout 30 | Out-Null
if ($job.State -ne 'Completed') {
    Stop-Job $job
    Write-Warning "Operation timed out after 30 seconds."
}
```

---

## 7.9 Error Propagation and Context

When rethrowing an error, always **add context**:
```powershell
catch {
    throw "Error retrieving record from $Uri: $($_.Exception.Message)"
}
```

Avoid:
- Blind rethrows (`throw $_`)
- Vague errors (“Something went wrong”)

The goal is **diagnosable traceability** — developers should know what failed and why.

---

## 7.10 Testing for Resilience

### Example: Pester Test

```powershell
Describe "Invoke-WithRetry" {
    It "Retries action on failure" {
        $attempts = 0
        $result = Invoke-WithRetry -Attempts 2 -Action {
            $attempts++
            if ($attempts -lt 2) { throw "Fail once" }
            return "Success"
        }
        $result | Should -Be "Success"
    }
}
```

Tests should verify:
- Errors are caught and logged.
- Retries occur as expected.
- Functions continue processing other inputs.

---

## 7.11 Review Checklist

| Question | Expectation |
|-----------|-------------|
| Are all errors classified (fatal, recoverable, warning)? | Yes |
| Does the function include try/catch/finally as appropriate? | Yes |
| Are retries and timeouts handled? | Yes |
| Are Write-Verbose/Warn/Error used consistently? | Yes |
| Are secrets excluded from error messages? | Yes |
| Do functions continue gracefully when partial failures occur? | Yes |
| Are error scenarios tested? | Yes |

---

## 7.12 Summary

| Concept | Key Practice |
|----------|---------------|
| Terminating vs Non-Terminating | Choose based on recovery potential |
| Defensive Coding | Validate inputs early |
| Retry Logic | Wrap unstable operations |
| Logging | Provide useful, structured feedback |
| Graceful Degradation | Fail per-item, not globally |
| Testing | Validate retries and error consistency |

---

## Next Chapter

Continue to **Chapter 08 — Configuration and Environment Design**
to learn how to externalize configuration, support multiple environments, and keep modules flexible without hardcoded settings.
