---
id: appendix-d
title: Appendix D – Provider Configuration Examples
sidebar_position: 4
description: Example provider/environment configuration references.
---

> “Hardcoded values are silent bugs waiting for deployment.”

This appendix provides reference examples for PowerShell configuration files (`.psd1`) that describe environments, providers, and runtime behavior.
By separating configuration from code, you make modules **portable**, **testable**, and **easy to extend** without code edits.

---

## D.1 Purpose

PowerShell’s `.psd1` format allows you to define **structured configuration** as a native hashtable.
Using `.psd1` files for configuration:

- Keeps logic and data separate.
- Enables environment- or provider-specific overrides.
- Supports versioning and validation.
- Prevents hardcoding in functions.

---

## D.2 Configuration Folder Structure

Recommended placement within a layered module:

```
PE.Compute.Common/
  data/
    ComputeEnvironment.psd1
    Provider.Nutanix.psd1
    Provider.Azure.psd1
    Provider.VMware.psd1
```

Each `.psd1` defines **static configuration** used by private helpers such as `Get-ProviderConfig` and `Get-ComputeEnvironment`.

---

## D.3 Example: Environment Configuration (`ComputeEnvironment.psd1`)

```powershell
@{
    EnvironmentName = 'Production'
    DefaultScheme   = 'https'
    DefaultDomain   = 'corp.local'
    DefaultPort     = 9440

    Logging = @{
        Level  = 'Info'       # Info | Debug | Warning | Error
        Target = 'EventLog'   # Console | File | EventLog
    }

    Behavior = @{
        RetryCount  = 3
        TimeoutSec  = 60
    }

    Overrides = @{
        # These allow environment variables to take precedence
        ProviderPath = $env:PE_PROVIDER_PATH
        LogPath      = $env:PE_LOG_PATH
    }
}
```

**Key Concepts**

| Section | Purpose |
|----------|----------|
| `EnvironmentName` | Defines logical deployment target. |
| `Defaults` | Establishes fallback scheme/domain/port. |
| `Logging` | Centralized behavior configuration. |
| `Behavior` | General timeout/retry defaults. |
| `Overrides` | Optional environment variable bindings. |

---

## D.4 Example: Provider Configuration (`Provider.Nutanix.psd1`)

```powershell
@{
    ProviderName = 'Nutanix'
    Description  = 'Nutanix AHV / Prism API Provider'
    ApiVersion   = '4'
    ApiNamespace = 'vmm'
    ApiBasePath  = ''
    DefaultPort  = 9440

    Auth = @{
        Method         = 'Basic'       # Basic | Token | OAuth
        UseInsecureSSL = $false
    }

    Clusters = @{
        Prism = @{ Host = 'prism';       Enabled = $true }
        SO    = @{ Host = 'ssoahv100p';  Enabled = $true }
        RC    = @{ Host = 'srcahv100p';  Enabled = $true }
        HD1T  = @{ Host = 'shdahv100t';  Enabled = $true }
    }

    Behavior = @{
        TimeoutSeconds       = 60
        RetryCount           = 3
        RetryBackoffSeconds  = 5
        ValidateCertificates = $true
    }

    Overrides = @{
        # Optional: environment variable overrides
        BaseUri = $env:NUTANIX_BASE_URI
        UseInsecureSSL = [bool]$env:NUTANIX_ALLOW_INSECURE
    }
}
```

**Notes**
- `Clusters` define unique connection points — easily extended without code changes.
- `Overrides` allow environment variables to adjust runtime values dynamically.
- `Behavior` centralizes retry and timeout logic used by `Invoke-ComputeRestRequest`.

---

## D.5 Example: Provider Configuration (`Provider.Azure.psd1`)

```powershell
@{
    ProviderName = 'Azure'
    Description  = 'Microsoft Azure Resource Manager API Provider'
    ApiVersion   = '2021-04-01'
    ApiNamespace = 'resources'
    ApiBasePath  = '/subscriptions'
    DefaultPort  = 443

    Auth = @{
        Method = 'OAuth' # uses Connect-AzAccount or token
    }

    Tenants = @{
        Primary = @{
            SubscriptionId = $env:AZ_SUBSCRIPTION_ID
            TenantId       = $env:AZ_TENANT_ID
        }
    }

    Behavior = @{
        TimeoutSeconds = 90
        RetryCount     = 3
    }
}
```

**Notes**
- Authentication handled externally (e.g., `Connect-AzAccount`).
- Environment variables bind securely to tenant details.
- Reusable across different subscription contexts.

---

## D.6 Example: Provider Configuration (`Provider.VMware.psd1`)

```powershell
@{
    ProviderName = 'VMware'
    Description  = 'vSphere Automation SDK Provider'
    ApiVersion   = 'v7.0'
    DefaultPort  = 443

    Auth = @{
        Method = 'Basic'
        UseInsecureSSL = $true
    }

    Servers = @{
        DC1 = @{ Host = 'vcenter01.corp.local'; Enabled = $true }
        LAB = @{ Host = 'vcenter-lab.corp.local'; Enabled = $false }
    }

    Behavior = @{
        TimeoutSeconds = 45
        RetryCount     = 2
    }
}
```

**Notes**
- `Enabled = $false` disables unused or lab instances.
- Central configuration keeps adapters environment-neutral.

---

## D.7 Loading Configuration in Code

Each module layer retrieves configuration using a simple helper, e.g.:

```powershell
function Get-ProviderConfig {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Provider)

    $path = Join-Path -Path "$PSScriptRoot/../data" -ChildPath "Provider.$Provider.psd1"
    if (-not (Test-Path $path)) {
        throw "Configuration not found for provider '$Provider'."
    }

    Import-PowerShellDataFile -Path $path
}
```

**Guidelines**
- Always import relative to module root.
- Fail fast with clear messages.
- Never embed secrets (use `Get-Credential` or secure stores).

---

## D.8 Override Hierarchy

Configuration values should follow a clear precedence:

```
1. Explicit function parameter
2. Environment variable
3. Provider configuration (.psd1)
4. Module-level default
```

This ensures predictable behavior without hardcoding.

Example Pattern:
```powershell
$timeout = $PSBoundParameters.TimeoutSec `
    ? $TimeoutSec `
    : ($env:PROVIDER_TIMEOUT ? [int]$env:PROVIDER_TIMEOUT : $config.Behavior.TimeoutSeconds)
```

---

## D.9 Benefits of Configuration-Driven Design

| Benefit | Description |
|----------|--------------|
| **Extensibility** | Add clusters/providers without code changes. |
| **Maintainability** | Operations can modify `.psd1` without redeploying code. |
| **Testability** | Swap configs for integration tests. |
| **Security** | Keep secrets external; use `Get-Credential` or DPAPI. |
| **Portability** | Same code, multiple environments. |

---

## D.10 Example — Dynamic Override in Action

```powershell
function New-NtxProviderSession {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][PSCredential]$Credential,
        [Parameter()][string]$Cluster = 'Prism'
    )

    $provider = Get-ProviderConfig -Provider 'Nutanix'
    $cluster  = $provider.Clusters[$Cluster]
    $uri      = if ($provider.Overrides.BaseUri) {
                    $provider.Overrides.BaseUri
                } else {
                    "https://$($cluster.Host).corp.local:$($provider.DefaultPort)"
                }

    [PSCustomObject]@{
        Provider   = $provider.ProviderName
        Cluster    = $Cluster
        ServerUri  = $uri
        Credential = $Credential
        Connected  = $false
    }
}
```

**Why It Works**
- Reads all base data from `.psd1`.
- Allows `$env:NUTANIX_BASE_URI` override.
- Keeps credentials out of static files.
- Predictable and testable behavior.

---

## D.11 Best Practices Checklist

| Category | Practice | Reason |
|-----------|-----------|--------|
| **Structure** | One file per provider/environment | Simplifies maintenance |
| **Location** | Store under `data/` folder | Conventional and discoverable |
| **Secrets** | Never store credentials | Use `PSCredential` |
| **Overrides** | Use environment variables | Enable runtime flexibility |
| **Consistency** | Common key names (`Behavior`, `Auth`, `Clusters`) | Easier cross-provider tooling |
| **Validation** | Check keys before use | Fail early and clearly |

---

## D.12 Summary

PowerShell configuration files (`.psd1`) provide a robust, declarative foundation for your automation ecosystem.
They make your code **flexible**, **testable**, and **resilient to change** — supporting new environments and providers without editing core logic.

When combined with the playbook’s modular layering (Core → Domain → Adapter → Context), configuration-driven design ensures you can evolve safely as systems grow.

---

**Next Appendix →**
[Appendix E — Style and Formatting Conventions](Appendix_E_Style_and_Formatting_Conventions.md)
