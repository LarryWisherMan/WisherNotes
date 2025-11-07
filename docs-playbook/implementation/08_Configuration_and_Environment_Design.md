---
id: configuration-and-environment-design
title: Configuration and Environment Design
sidebar_position: 8
description: Externalizing configuration and managing environment flexibility.
---

> “Hardcoding is a shortcut today that becomes technical debt tomorrow.”

This chapter explains how to externalize configuration — so your modules adapt to different environments (dev, test, prod) without rewriting code.
You will learn to design `.psd1` configuration files, safely handle credentials, and dynamically resolve environments at runtime.

---

## 8.1 Why Configuration Matters

Without external configuration, PowerShell code becomes brittle:

| Problem | Example | Result |
|----------|----------|--------|
| Hardcoded URLs | `$api = 'https://prod.api.com'` | Must edit code to test |
| Embedded credentials | `$password = 'P@ssw0rd'` | Security risk |
| Scattered constants | Repeated timeouts or ports | Difficult to maintain |
| Environment-specific logic | `if ($env -eq 'prod') { ... }` | Unscalable and error-prone |

By separating **data** from **logic**, we gain:
- Easier maintenance
- Consistent environment behavior
- Safer secret management
- Simpler deployment and testing

---

## 8.2 The Role of Configuration in Each Layer

| Layer | Configuration Concern | Example |
|--------|-----------------------|----------|
| **Core** | Defaults, behavior flags | Retry count, timeout seconds |
| **Domain** | Business rules | Naming rules, thresholds |
| **Adapter** | Connection info | API URIs, ports, SSL policy |
| **Context** | Environment selection | Active provider, environment name |

Each layer reads configuration from structured files or services rather than hardcoded values.

---

## 8.3 Configuration Storage: The `.psd1` File

PowerShell data files (`.psd1`) are native configuration containers — safe, structured, and easy to version-control.

### Example: Provider Configuration (`Provider.Nutanix.psd1`)

```powershell
@{
    ProviderName = 'Nutanix'
    ApiVersion   = '4'
    ApiNamespace = 'vmm'
    DefaultPort  = 9440

    Auth = @{
        Method         = 'Basic'
        UseInsecureSSL = $false
    }

    Clusters = @{
        Prism = @{ Host = 'prism';     Enabled = $true }
        SO    = @{ Host = 'ssoahv100p'; Enabled = $true }
    }

    Behavior = @{
        TimeoutSeconds      = 60
        RetryCount          = 3
        RetryBackoffSeconds = 5
    }
}
```

This file defines provider-specific constants, URIs, and defaults — no code edits required to add new clusters.

---

## 8.4 Environment Configuration Example

A central configuration file can define global environment properties.

**`ComputeEnvironment.psd1`**
```powershell
@{
    DefaultScheme = 'https'
    DefaultDomain = 'corp.example.com'
    DefaultPort   = 9440
    Environments = @{
        Dev  = @{ Domain = 'dev.example.com' }
        Test = @{ Domain = 'test.example.com' }
        Prod = @{ Domain = 'prod.example.com' }
    }
}
```

**Usage:**
```powershell
$envConfig = Import-PowerShellDataFile -Path "$PSScriptRoot\data\ComputeEnvironment.psd1"
$domain = $envConfig.Environments.Prod.Domain
```

---

## 8.5 Loading Configuration at Runtime

Centralize configuration retrieval in helper functions.

### Example
```powershell
function Get-ComputeEnvironment {
    [CmdletBinding()]
    param([string]$Environment = 'Prod')

    $path = Join-Path $PSScriptRoot "data\ComputeEnvironment.psd1"
    if (-not (Test-Path $path)) { throw "Configuration missing at $path" }

    $config = Import-PowerShellDataFile -Path $path
    return $config.Environments[$Environment]
}
```

This isolates configuration logic — the rest of the module can simply call `Get-ComputeEnvironment`.

---

## 8.6 Configuration Design Principles

| Principle | Description |
|------------|--------------|
| **Single Source of Truth** | Keep one definitive config per concern (environment, provider, defaults). |
| **Immutable at Runtime** | Don’t modify configuration in memory — clone or override locally. |
| **Discoverable Defaults** | Use `Get-ComputeEnvironment` or `Get-ProviderConfig` to expose settings. |
| **Layer Awareness** | Core shouldn’t depend on environment; Context determines which config applies. |
| **Version Control Friendly** | Keep `.psd1` files small and human-readable. |

---

## 8.7 Handling Credentials Securely

Never store passwords or tokens in `.psd1` files.
Instead, use `Get-Credential`, DPAPI, or a secret vault.

### Example: Using DPAPI (Windows only)

```powershell
# Store credential securely
$credential = Get-Credential
$securePath = "$env:APPDATA\PE\credential.xml"
$credential | Export-Clixml -Path $securePath

# Load credential later
$credential = Import-Clixml -Path $securePath
```

### Example: Using SecretManagement Module
```powershell
Set-Secret -Name 'PE-Compute-Cred' -Secret (Get-Credential)
$cred = Get-Secret -Name 'PE-Compute-Cred'
```

---

## 8.8 Dynamic Configuration Resolution

You can resolve which provider or environment to use at runtime.

### Example
```powershell
function Resolve-ActiveProvider {
    [CmdletBinding()]
    param([string]$Provider = 'Nutanix')

    $providerPath = Join-Path $PSScriptRoot "data\Provider.$Provider.psd1"
    if (-not (Test-Path $providerPath)) {
        throw "Provider configuration not found for '$Provider'."
    }

    Import-PowerShellDataFile -Path $providerPath
}
```

This allows commands like:
```powershell
$provider = Resolve-ActiveProvider -Provider 'Nutanix'
```
without hardcoding provider logic.

---

## 8.9 Configuration Overrides (In-Memory)

Sometimes you need to override configuration temporarily.

### Example
```powershell
$config = Get-ComputeEnvironment -Environment 'Test'
$configClone = $config.PSObject.Copy()
$configClone.Domain = 'temporary.dev.example.com'
```

**Rule:** Never modify global configuration directly; always clone before changing values.

---

## 8.10 Configuration Overrides with Environment and Script Variables

Configuration files define defaults, but real-world automation often needs **temporary or contextual overrides**.
For example:
- CI pipelines may need to force a `Test` environment.
- Developers may need to point to a staging API temporarily.
- Admins may toggle debug or timeout values for a single session.

PowerShell supports multiple override layers, which can coexist safely if designed intentionally.

---

### 8.10.1 Precedence Rules (Recommended Pattern)

Configuration values should be resolved in the following order:

1. **Explicit parameters** — passed directly to a function or command
2. **Environment variables** — session or process scope
3. **Script/global variables** — internal defaults or CI injection
4. **Configuration files (`.psd1`)** — persistent, versioned defaults
5. **Hardcoded fallback** — last-resort constants (avoid when possible)

**Visual Model:**
```
Parameter > Env Var > Script Var > Config File > Default
```

This lets you override configuration without modifying source files.

---

### 8.10.2 Using Environment Variables

**Example:**
```powershell
# Set temporary override
$env:PE_ENVIRONMENT = 'Test'
$env:PE_PROVIDER = 'Nutanix'

function Get-ActiveEnvironment {
    [CmdletBinding()]
    param()

    if ($env:PE_ENVIRONMENT) {
        return $env:PE_ENVIRONMENT
    }

    # Default to production if not defined
    return 'Prod'
}
```

**Use Cases**
- CI/CD pipelines (`PE_ENVIRONMENT=CI`)
- Local developer overrides
- Security policies that load secrets from environment variables

---

### 8.10.3 Using Script-Scoped Variables

Script variables can store context for the current session or module:
```powershell
# Set once per session
Set-Variable -Name "PE_DefaultEnvironment" -Value "Test" -Scope Script

function Get-DefaultEnvironment {
    if (Get-Variable -Name "PE_DefaultEnvironment" -Scope Script -ErrorAction SilentlyContinue) {
        return $script:PE_DefaultEnvironment
    }
    return 'Prod'
}
```

This technique avoids global pollution and keeps context local to the current module.

---

### 8.10.4 Integrating Overrides with Config Loaders

You can combine `.psd1` loading with overrides from environment or script variables:

```powershell
function Get-EffectiveEnvironmentConfig {
    [CmdletBinding()]
    param()

    $envName = $env:PE_ENVIRONMENT
    if (-not $envName -and (Get-Variable -Name 'PE_DefaultEnvironment' -Scope Script -ErrorAction SilentlyContinue)) {
        $envName = $script:PE_DefaultEnvironment
    }
    if (-not $envName) { $envName = 'Prod' }

    $config = Import-PowerShellDataFile -Path "$PSScriptRoot\data\ComputeEnvironment.psd1"
    return $config.Environments[$envName]
}
```

**Result:**
- Environment variables override script defaults.
- Script defaults override configuration file defaults.
- The function always resolves an environment, even if nothing is set.

---

### 8.10.5 Practical Example: Dynamic Provider Resolution

```powershell
function Resolve-Provider {
    [CmdletBinding()]
    param()

    $provider = $env:PE_PROVIDER
    if (-not $provider) { $provider = 'Nutanix' }

    $configPath = Join-Path $PSScriptRoot "data\Provider.$provider.psd1"
    if (-not (Test-Path $configPath)) {
        throw "Provider configuration not found for '$provider'."
    }

    Import-PowerShellDataFile -Path $configPath
}
```

This enables dynamic provider selection without changing code:
```powershell
$env:PE_PROVIDER = 'Azure'
Find-VM -Names 'web01'
```

---

### 8.10.6 Guidelines for Override Use

| Rule | Rationale |
|------|------------|
| Keep `.psd1` files as your **baseline** | They define defaults for all environments. |
| Use environment variables for **short-term or CI overrides** | Avoid committing them to source control. |
| Use script variables for **module-level context** | Keeps overrides local and predictable. |
| Always provide a fallback value | Prevents null references when overrides are missing. |
| Log active configuration in verbose mode | Helps diagnose environment mismatches. |

---

### 8.10.7 Example Verbose Log Pattern

```powershell
Write-Verbose ("[Config] Using environment: {0}" -f ($env:PE_ENVIRONMENT ?? 'Prod'))
Write-Verbose ("[Config] Provider: {0}" -f ($env:PE_PROVIDER ?? 'Nutanix'))
```

> **Tip:** Always surface active configuration details when `-Verbose` is enabled. It’s invaluable for debugging.

---

### 8.10.8 Summary of Override Behavior

| Source | Scope | Priority | Typical Use |
|---------|--------|-----------|--------------|
| Function Parameters | Runtime | Highest | Explicit user or script input |
| Environment Variables | Process/System | High | CI/CD, system policy |
| Script Variables | Session | Medium | Developer context |
| `.psd1` Config | Module | Baseline | Persistent configuration |
| Defaults | Code | Lowest | Fallback safety |

This layered precedence pattern balances flexibility with stability — allowing automation to adapt safely to multiple environments.

---

## 8.11 Validating Configuration

Always verify that loaded configuration is complete.

### Example
```powershell
if (-not $config.DefaultDomain) {
    throw "Configuration missing 'DefaultDomain' property."
}
```

You can also define schema validators per file to enforce required keys.

---

## 8.12 Combining Configurations Across Layers

Each layer reads only the portion it needs:

| Layer | Configuration Source | Example |
|--------|----------------------|----------|
| Core | Defaults | Retry counts, timeouts |
| Domain | Business rules | Naming patterns, validation rules |
| Adapter | Provider config | API URIs, auth settings |
| Context | Environment selection | Active cluster, environment mode |

This separation ensures no circular dependencies — adapters never influence core behavior.

---

## 8.13 Example: End-to-End Configuration Flow

Goal: Connect to the correct Nutanix cluster based on environment.

**Process**
1. Context loads environment config (`Get-ComputeEnvironment`).
2. Adapter loads provider config (`Get-ProviderConfig`).
3. Core builds URI (`New-ComputeUri`).
4. Session established (`New-NtxProviderSession`).

**Flow Diagram**
```
User → Context (Find-VM)
   ↓
Get-ComputeEnvironment.psd1
   ↓
Get-ProviderConfig.psd1
   ↓
New-ComputeUri → "https://prism.prod.example.com:9440"
   ↓
New-NtxProviderSession (Credential + URI)
```

---

## 8.14 Testing Configuration

Use Pester to validate configuration files.

### Example
```powershell
Describe "Configuration Validation" {
    It "Provider.Nutanix.psd1 contains required keys" {
        $config = Import-PowerShellDataFile -Path "data\Provider.Nutanix.psd1"
        $config | Should -Not -BeNullOrEmpty
        $config.Clusters.Keys | Should -Contain 'Prism'
    }
}
```

This ensures configurations remain consistent as teams update them.

---

## 8.15 Review Checklist

| Question | Expectation |
|-----------|-------------|
| Are configuration values externalized to `.psd1` files? | Yes |
| Are credentials stored securely (not in source)? | Yes |
| Can configuration be switched by environment? | Yes |
| Are environment and script variable overrides supported? | Yes |
| Are defaults consistent across modules? | Yes |
| Are schema validations or Pester tests in place? | Yes |
| Are overrides isolated to runtime? | Yes |

---

## 8.16 Summary

| Concept | Best Practice |
|----------|----------------|
| Separation of logic and data | Use `.psd1` configuration |
| Secure credentials | DPAPI or SecretManagement |
| Layered configuration | Context → Adapter → Domain → Core |
| Environment overrides | Env var → Script var → Config → Default |
| Mutability | Never modify global config in place |
| Validation | Enforce required keys with tests |
| Flexibility | Allow runtime environment selection |

---

## Next Chapter

Continue to **Chapter 09 — Testing and Quality Discipline**
to learn how to design effective Pester tests that verify contracts, simulate environments, and ensure module reliability across all layers.
