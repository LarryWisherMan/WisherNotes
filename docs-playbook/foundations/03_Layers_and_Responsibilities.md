---
id: layers-and-responsibilities
title: Layers and Responsibilities
sidebar_position: 3
description: Defines Core, Domain, Adapter, Context, and Infrastructure layers for scalable design.
---

> “Good architecture doesn’t prevent change — it makes change cheap.”

This chapter explains how to structure PowerShell code into clear, maintainable **layers**.
Each layer has a distinct purpose, depends only on the layer beneath it, and communicates through simple, testable boundaries.

---

## 3.1 Why Layers Matter

Without clear layering, scripts quickly become tangled:

- A function that queries data also formats output.
- Business logic depends directly on a REST API.
- Testability is lost because everything runs at once.

Layering untangles these responsibilities.
It lets you replace or extend parts (for example, switching an API or adding caching) without rewriting your entire module.

### Common Problems Layering Solves

| Problem | Symptom | Result |
|----------|----------|--------|
| Tight coupling | Functions directly call REST APIs | Hard to change providers |
| Mixed concerns | Business logic writes output | Not reusable |
| Hidden dependencies | Global variables, environment state | Fails in CI/CD |
| Inconsistent return types | Different formats per function | Unusable in pipelines |

Layering replaces this chaos with predictable, stable structure.

---

## 3.2 The Layer Stack (Overview)

The layers in a PowerShell module are similar to those in larger software systems, just adapted to scripting scale.

```
┌─────────────────────────────┐
│         Context              │
│  (User-facing orchestration) │
└───────────────┬─────────────┘
│
┌───────────────┴─────────────┐
│          Domain              │
│ (Rules, transforms, models)  │
└───────────────┬─────────────┘
│
┌───────────────┴─────────────┐
│            Core              │
│ (Generic, pure utilities)    │
└───────────────┬─────────────┘
│
┌───────────────┴─────────────┐
│          Adapter             │
│ (APIs, SDKs, external I/O)   │
└─────────────────────────────┘
```

### Dependency Rule
Only depend downward:

```
Context  →  Domain  →  Core
↑
Adapter
```

The domain never imports or depends on adapters.
The adapter’s job is to map **real-world systems** into the clean contracts that the domain understands.

---

## 3.3 The Core Layer

### Purpose
The **Core** layer provides generic utilities that can be reused across domains and contexts.
These are pure functions — deterministic, reusable, and easy to test.

### Examples
- `Invoke-Retry` — retry a script block a fixed number of times.
- `New-ComputeUri` — build consistent URIs from environment and host data.
- `Write-Log` — structured logging.

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
        try { return & $Action }
        catch {
            if ($i -lt $Attempts) {
                Start-Sleep -Seconds $DelaySeconds
            } else {
                throw $_
            }
        }
    }
}
```

**Guidelines**

| Rule | Reason |
|------|--------|
| Pure functions only | Enables deterministic testing |
| No dependencies on APIs, credentials, or files | Core must be portable |
| Reusable by any domain | Generic utilities live here |

---

## 3.4 The Domain Layer

### Purpose

The Domain layer expresses the rules and data structures of your system — for example, VMs, servers, or clusters.
It defines what valid data looks like and how to transform or interpret it.

### Examples
- `ConvertTo-VMRecord` — normalize VM data into a standard record.
- `Test-VMIsRunning` — return `$true` or `$false` for VM power state.
- `Measure-ClusterCapacity` — calculate total resources from raw input.

### Example Implementation

```powershell
function ConvertTo-VMRecord {
    [CmdletBinding()]
    param([object]$InputObject)

    [PSCustomObject]@{
        Name        = $InputObject.name
        Status      = $InputObject.power_state
        ClusterName = $InputObject.cluster_name
        PSTypeName  = 'PE.Compute.VMRecord.v1'
    }
}
```

**Guidelines**

| Rule | Reason |
|------|--------|
| No external I/O | Keeps logic pure |
| Output always structured | Supports pipelines |
| Use versioned PSTypeName | Prevents breaking contracts |
| Accept plain objects | Maximizes reusability |

---

## 3.5 The Adapter Layer

### Purpose

The Adapter layer connects your PowerShell domain to the outside world: REST APIs, SDKs, files, or CLI tools.
This is the layer where side effects are expected — authentication, HTTP calls, and file access.

### Examples
- `Invoke-NtxRequest` — call Nutanix REST API.
- `Connect-AzProvider` — authenticate with Azure.
- `Get-FileMetadata` — read file system data.

### Example Implementation

```powershell
function Invoke-SystemRequest {
    [CmdletBinding()]
    param(
        [string]$Uri,
        [PSCredential]$Credential
    )

    $headers = @{
        Authorization = 'Basic ' + [Convert]::ToBase64String(
            [Text.Encoding]::ASCII.GetBytes("$($Credential.UserName):$( `
                [Runtime.InteropServices.Marshal]::PtrToStringAuto( `
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Credential.Password)))"))
    }

    Invoke-RestMethod -Uri $Uri -Headers $headers -UseBasicParsing
}
```

**Guidelines**

| Rule | Reason |
|------|--------|
| Contain all side effects | Keeps upper layers pure |
| Centralize API behavior | Easier to maintain and test |
| Handle errors gracefully | Adapters are failure-prone |
| Never return raw responses | Normalize outputs for the domain |

---

## 3.6 The Context Layer

### Purpose

The Context layer provides user-facing commands — orchestrations that combine multiple layers to perform meaningful work.
This is where you implement your module’s verbs (Find, Sync, New, Remove).

### Examples
- `Find-VM` — orchestrates domain + adapter to search VMs.
- `Sync-ClusterInventory` — merges provider data into cache.
- `Repair-HostMapping` — orchestrates discovery + update.

### Example Implementation

```powershell
function Find-VM {
    [CmdletBinding()]
    param([string[]]$Names)

    $results = @()
    foreach ($name in $Names) {
        $data = Invoke-SystemRequest -Uri "https://api/vms?name=$name"
        $results += ConvertTo-VMRecord -InputObject $data
    }
    return $results
}
```

**Guidelines**

| Rule | Reason |
|------|--------|
| Combine layers, not logic | Context orchestrates, doesn’t compute |
| Provide clear input/output | User-facing functions define the contract |
| Support pipelines | Enables composition |
| Use Write-Verbose/Write-Error, not Write-Host | Consistent with PowerShell conventions |

---

## 3.7 Layer Interactions: Example Walkthrough

**Feature Goal:** Retrieve all running servers from a provider API.

```
Find-Server (Context)
│
├── Invoke-ProviderRequest (Adapter)
│     └── Invoke-RestMethod (Core helper)
│
└── ConvertTo-ServerRecord (Domain)
```

### Execution Flow
1. **Context** orchestrates:
   - Accepts user parameters.
   - Calls `Invoke-ProviderRequest` (adapter).
   - Transforms data using domain logic.
2. **Adapter** handles:
   - HTTP communication.
   - Authentication and headers.
3. **Domain** handles:
   - Data shaping.
   - Filtering or validation.
4. **Core** handles:
   - Generic utilities (retry, logging, URI construction).

Each layer depends only on the next — making the feature testable, reusable, and maintainable.

---

## 3.8 Folder Structure Example

```
PE.Compute.Common/
  data/
    Provider.Nutanix.psd1
  Public/
    Find-VM.ps1
  Private/
    Core/
      Invoke-Retry.ps1
      New-ComputeUri.ps1
    Domain/
      ConvertTo-VMRecord.ps1
      Test-VMIsRunning.ps1
    Adapter/
      Invoke-NtxRequest.ps1
      New-NtxAuthHeader.ps1
    Context/
      Find-VM.ps1
```

This structure keeps logical boundaries visible.
Each folder can eventually evolve into its own module.

---

## 3.9 Layer-Specific Contracts

Each layer has a different kind of contract:

| Layer | Contract Type | Example Guarantee |
|--------|----------------|-------------------|
| Core | Input/output type | `Invoke-Retry` always returns the result of the script block |
| Domain | Object shape | `ConvertTo-VMRecord` always returns Name and Status |
| Adapter | API surface | `Invoke-NtxRequest` always returns normalized REST data |
| Context | User interface | `Find-VM` always accepts `-Names` and outputs VM records |

These contracts are what allow different layers to evolve independently without breaking each other.

---

## 3.10 Review Checklist

When designing a feature or reviewing code:

| Question | Expectation |
|-----------|-------------|
| Does each function belong to one layer? | Yes |
| Are layers only depending downward? | Yes |
| Does the context layer contain orchestration, not logic? | Yes |
| Do adapters isolate all I/O? | Yes |
| Are outputs consistent across layers? | Yes |
| Is the folder structure aligned with layers? | Yes |

---

## 3.11 Summary

| Layer | Purpose | Rule |
|--------|----------|------|
| Core | Generic utilities | Pure, testable, reusable |
| Domain | Rules and transforms | Defines business meaning |
| Adapter | External integration | Isolate all side effects |
| Context | Orchestration and UX | Combine layers, not logic |

---

## Next Chapter

Continue to **Chapter 04 — Function Behavior and Composition**
to learn how to design pipeline-friendly, composable functions that follow PowerShell conventions while preserving architecture boundaries.
