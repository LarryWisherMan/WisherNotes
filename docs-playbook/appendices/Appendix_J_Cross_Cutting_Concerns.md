---
id: appendix-j
title: Appendix J – Cross-Cutting Concerns
sidebar_position: 10
description: Handling shared infrastructure such as logging, caching, and metrics.
---

> “Cross-cutting concerns are the invisible glue that holds reliable systems together.”

This appendix explores **cross-cutting concerns** — functions and modules that operate *across layers* of your architecture.
Unlike domain-specific logic (e.g., VM management), these features apply to *every layer* — logging, secrets, error handling, and telemetry.

They are essential for building observable, secure, and maintainable PowerShell systems.

---

## J.1 Purpose

Cross-cutting concerns are behaviors that:
- Appear in multiple places across the codebase.
- Are not part of core business logic.
- Must remain consistent everywhere they’re used.

Examples:
- Logging (`Write-Log`)
- Secrets and credentials
- Error handling
- Telemetry (timing, metrics, traces)
- Retry and resilience logic

Without structure, these can easily leak into every function, causing duplication and inconsistent behavior.

---

## J.2 Where Cross-Cutting Concerns Belong

In a layered architecture, cross-cutting logic belongs in a **shared infrastructure layer** — reusable, imported by other layers.

```
Presentation (optional)
    ↓
Context — orchestrates domain logic
    ↓
Domain — defines business rules
    ↓
Infrastructure — cross-cutting utilities
    ↓
Core — foundational helpers
    ↑
Adapters — external systems
```

### Infrastructure Responsibilities
| Concern | Description | Typical Implementation |
|----------|--------------|------------------------|
| Logging | Capture diagnostic messages | `Write-Log`, event files |
| Secrets | Securely store and retrieve credentials | DPAPI, SecretManagement |
| Telemetry | Record execution metrics | App Insights, custom JSON logs |
| Error Policy | Retry, circuit-breakers | `Invoke-Retry`, `Invoke-Safely` |
| Configuration | Manage environment overrides | Environment + psd1 hybrid |

---

## J.3 Logging

Logging provides visibility into what your automation is doing.
For PowerShell modules, logging should be structured, level-based, and environment-safe.

### Principles
1. Never use `Write-Host` — use structured cmdlets.
2. Support levels: `Info`, `Warning`, `Error`, `Debug`, `Verbose`.
3. Emit machine-readable output (JSON or text).

### Example

```powershell
function Write-Log {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Message,
        [ValidateSet('Info','Warning','Error','Debug','Verbose')]
        [string]$Level = 'Info',
        [string]$Component
    )

    $timestamp = (Get-Date).ToString('s')
    $entry = [PSCustomObject]@{
        Time      = $timestamp
        Level     = $Level
        Component = $Component
        Message   = $Message
    }

    switch ($Level) {
        'Error'   { Write-Error $Message }
        'Warning' { Write-Warning $Message }
        'Verbose' { Write-Verbose $Message }
        'Debug'   { Write-Debug $Message }
        default   { Write-Information $Message }
    }

    # Optionally persist to a file
    # $entry | ConvertTo-Json -Compress | Out-File "$env:TEMP\ModuleLog.json" -Append
}
```

> Use `Write-Log` internally in Core, Domain, and Adapter layers, but not in public output.
> Public functions should surface errors or results, not log text directly.

---

## J.4 Secrets and Credential Management

Automation is only as secure as how it handles credentials.
Never embed secrets or tokens in code or configuration files.

### Common Techniques

| Technique | Example | Notes |
|------------|----------|------|
| **DPAPI (Windows)** | `ConvertFrom-SecureString -AsPlainText` | Works locally, machine-bound |
| **SecretManagement Module** | `Get-Secret -Name 'ProdCredential'` | Cross-platform, provider-based |
| **Environment Variables** | `$env:API_KEY` | Simple but less secure |
| **Vaults (Azure, 1Password, etc.)** | `Get-Secret -Vault 'AzureKeyVault'` | Enterprise-friendly |

### Example Pattern (DPAPI)

```powershell
function Get-StoredCredential {
    [CmdletBinding()]
    param([string]$Name)

    $path = Join-Path "$env:APPDATA\PE.Secrets" "$Name.cred"
    if (-not (Test-Path $path)) { throw "Credential file not found: $path" }

    $secure = Get-Content $path | ConvertTo-SecureString
    New-Object PSCredential ($Name, $secure)
}

function Set-StoredCredential {
    [CmdletBinding()]
    param([PSCredential]$Credential)

    $path = Join-Path "$env:APPDATA\PE.Secrets" "$($Credential.UserName).cred"
    $Credential.Password | ConvertFrom-SecureString | Set-Content $path
}
```

> Secrets are stored encrypted on disk using Windows DPAPI — safe for local use, portable between sessions on the same machine.

---

## J.5 Error Handling and Retry Policies

Errors are not exceptions to design — they’re *part of* the design.

### Recommended Pattern

- **Core:** provides `Invoke-Retry` and `Invoke-Safely`.
- **Domain:** assumes inputs are valid and throws only logic errors.
- **Adapters:** catch network and API errors, wrap them with context.
- **Context:** reports errors gracefully to the user.

### Example

```powershell
function Invoke-Safely {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][scriptblock]$Action,
        [int]$Retries = 3,
        [int]$DelaySeconds = 2
    )

    for ($i = 1; $i -le $Retries; $i++) {
        try {
            return & $Action
        }
        catch {
            Write-Warning "Attempt $i failed: $($_.Exception.Message)"
            if ($i -lt $Retries) { Start-Sleep -Seconds $DelaySeconds }
            else { throw $_ }
        }
    }
}
```

---

## J.6 Telemetry and Observability

Telemetry enables insight into **how** modules behave in production.
It includes metrics such as:
- Duration of operations
- Error frequency
- Environment or version details

### Example (File-Based)

```powershell
function Write-Telemetry {
    [CmdletBinding()]
    param(
        [string]$Operation,
        [TimeSpan]$Duration,
        [string]$Status = 'Success'
    )

    $entry = [PSCustomObject]@{
        Time       = (Get-Date).ToString('s')
        Operation  = $Operation
        DurationMs = [math]::Round($Duration.TotalMilliseconds)
        Status     = $Status
    }

    $path = "$env:ProgramData\PE.Telemetry\metrics.log"
    if (-not (Test-Path (Split-Path $path))) { New-Item -ItemType Directory -Path (Split-Path $path) | Out-Null }
    $entry | ConvertTo-Json -Compress | Out-File -FilePath $path -Append -Encoding utf8
}
```

### Integration Points
Telemetry may later integrate with:
- Windows Event Log
- Azure Application Insights
- Syslog / JSON endpoints

> Keep it optional and configurable — telemetry should never block a workflow.

---

## J.7 Configuration and Override Strategy

All cross-cutting behaviors (logging, secrets, telemetry) should be configurable.
Follow the **hierarchy of configuration**:

1. **Runtime Parameters** — passed explicitly (e.g., `-Verbose`, `-LogPath`)
2. **Environment Variables** — `$env:PE_LOG_LEVEL`
3. **Static Config (.psd1)** — defaults in `/data/InfrastructureConfig.psd1`
4. **Code Defaults** — last-resort fallbacks

### Example

```powershell
$logLevel = $env:PE_LOG_LEVEL
if (-not $logLevel) {
    $config = Import-PowerShellDataFile "$PSScriptRoot\data\InfrastructureConfig.psd1"
    $logLevel = $config.LogLevel
}
```

---

## J.8 Checklist

| Concern | Best Practice |
|----------|----------------|
| Logging | Use structured `Write-Log`, never `Write-Host` |
| Secrets | Use DPAPI or SecretManagement |
| Error Handling | Use `Invoke-Safely` with retry and delay |
| Telemetry | Record duration and status to file or endpoint |
| Configuration | Respect runtime → env → psd1 → default hierarchy |
| Cross-Layer Use | Core utilities, no UI interaction |

---

## J.9 Summary

| Concept | Key Takeaway |
|----------|---------------|
| Logging | Observability enables maintainability |
| Secrets | Treat credentials as first-class citizens, not strings |
| Telemetry | Instrument everything, fail silently |
| Error Handling | Design for resilience, not perfection |
| Configuration | Externalize to adapt without editing code |

> These cross-cutting concerns form your system’s “nervous system.”
> They connect independent functions into a coherent, reliable platform.

---

**End of Appendix J**
