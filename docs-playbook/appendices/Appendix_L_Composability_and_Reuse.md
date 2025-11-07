---
id: appendix-l
title: Appendix L – Composability and Reuse
sidebar_position: 12
description: Function chaining, partial application, and DRY composition patterns.
---

> “Don’t copy logic — compose it.”

This appendix explains how to build PowerShell functions and modules that are **composable**, **reusable**, and **maintainable**.
Composability is the art of assembling small, well-behaved pieces into larger, more powerful systems without creating tight coupling.

---

## L.1 What Is Composability?

Composability means:
> Functions can be combined predictably because they have consistent contracts.

Each function:
- Does one thing.
- Has clear inputs and outputs.
- Returns objects, not text.
- Follows predictable naming and behavior conventions.

### Example

```powershell
# Independent, reusable functions
function Get-Server { ... }
function Test-ServerIsHealthy { ... }
function Repair-Server { ... }

# Composed workflow
Get-Server | Where-Object Name -like 'WEB*' | ForEach-Object {
    if (-not (Test-ServerIsHealthy -Server $_.Name)) {
        Repair-Server -Server $_.Name
    }
}
```

Here, `Get-Server`, `Test-ServerIsHealthy`, and `Repair-Server` are reusable in isolation but form a complete workflow when piped together.

---

## L.2 Principles of Reuse

| Principle | Description | Example |
|------------|--------------|----------|
| **Single Responsibility** | Each function does one thing | `ConvertTo-VMRecord` just transforms data |
| **Consistency** | Shared parameter names and types | Always `-Name`, never `-ServerName` |
| **Pure Output** | Return PSCustomObjects | Enables downstream composition |
| **Extensibility** | Support optional parameters, not mandatory breaking ones | Add `-IncludeOffline` instead of changing defaults |
| **Abstraction** | Hide implementation behind contracts | Call `Invoke-ProviderRequest` instead of `Invoke-RestMethod` directly |

---

## L.3 Function Composition Patterns

### 1. Sequential Composition (Pipelines)

Each function’s output becomes another’s input.

```powershell
Get-VM | Where-Object PowerState -eq 'Off' | Start-VM
```

**Guideline:**
Return structured objects, not strings, to ensure the pipeline works predictably.

---

### 2. Declarative Composition

Use small helpers to *describe* rather than *command* behavior.

```powershell
$vmList = Get-VM | Where-Object Cluster -eq 'Production'
$plan = $vmList | ForEach-Object { [PSCustomObject]@{ Name=$_.Name; Action='Backup' } }
Invoke-Plan $plan
```

Declarative style allows for simulation (`-WhatIf`), dry runs, and easier debugging.

---

### 3. Layered Composition

Functions from lower layers support higher ones without duplication.

```
Find-VM (Context)
└── ConvertTo-VMRecord (Domain)
    └── Invoke-NtxRequest (Adapter)
        └── Invoke-ComputeRestRequest (Core)
```

Each layer composes with the next — dependencies flow downward.

---

## L.4 Composable Function Anatomy

For a function to be composable, it must:

| Rule | Description |
|------|--------------|
| Accept input via parameters and pipeline | Use `[Parameter(ValueFromPipeline)]` |
| Return PSCustomObject | No text or Write-Host |
| Avoid side effects | Don’t change global state |
| Be predictable | Same input → same output |
| Use `CmdletBinding()` | Enables advanced pipeline behavior |

Example:

```powershell
function Get-ServiceHealth {
    [CmdletBinding()]
    param(
        [Parameter(ValueFromPipeline)]
        [string]$Name
    )

    process {
        $svc = Get-Service -Name $Name -ErrorAction SilentlyContinue
        [PSCustomObject]@{
            Name   = $svc.Name
            Status = $svc.Status
        }
    }
}
```

---

## L.5 Building Reusable Modules

Reusable modules are collections of related functions that share a purpose and vocabulary.

### Steps to Build

1. **Group by Domain**
   - e.g., Compute, Storage, Network, Identity.
2. **Define Public vs Private**
   - Public = stable user-facing commands.
   - Private = internal utilities.
3. **Version Contracts**
   - Use `PSTypeName` for version tagging.
4. **Document and Test**
   - Include comment-based help and Pester tests.

### Example Structure

```
PE.Compute.Common/
  Public/
    Find-VM.ps1
    Get-VM.ps1
  Private/
    Providers/
      Invoke-NtxRequest.ps1
    Core/
      Invoke-Retry.ps1
      Write-Log.ps1
  data/
    Provider.Nutanix.psd1
```

---

## L.6 Dev Modules vs User Modules

### Developer Modules
- Contain *building blocks* (Core, Domain, Adapter).
- Used by other engineers to construct automation.
- All or most functions are **private**.
- Imported explicitly (`Import-Module -Force`).

### User Modules
- Contain **public**, user-facing commands (Context).
- Consumed by broader teams or non-developers.
- Depend on developer modules for implementation.
- Designed for discoverability (`Get-Command -Module`).

#### Example Relationship

```
PE.Core              → Shared utilities (Core)
PE.Compute.Providers → Vendor adapters (Adapter)
PE.Compute.Core      → Domain logic (Domain)
PE.Compute.Discovery → User workflows (Context)
PE.Server            → Bundle for end-users
```

> Dev modules are the “engine room.”
> User modules are the “dashboard.”

---

## L.7 Avoiding Over-Modularization

Too many small modules create dependency sprawl.
Too few create clutter and coupling.

### Balance Heuristics

| Symptom | Action |
|----------|--------|
| Many unrelated functions in one module | Split by domain |
| Same helpers copied across modules | Move to Core |
| Hard to track dependencies | Consolidate |
| Team-specific code in global module | Extract to internal module |

---

## L.8 Composability and Contracts

Reusable functions rely on **contracts** — the guarantee that input and output types won’t change unexpectedly.

Example:

```powershell
# Domain layer
function ConvertTo-ServerRecord {
    [CmdletBinding()]
    param([object]$Data)
    [PSCustomObject]@{
        Name   = $Data.name
        Status = $Data.status
        PSTypeName = 'PE.Server.Record.v1'
    }
}
```

> Future versions may add fields but never rename or remove them — preserving composability.

---

## L.9 Testing for Reuse

Unit tests should verify that each function:
1. Accepts expected input types.
2. Returns structured objects.
3. Can be combined safely in pipelines.

Example Pester snippet:

```powershell
Describe 'ConvertTo-ServerRecord Reuse' {
    It 'returns a PSCustomObject with Name and Status' {
        $result = ConvertTo-ServerRecord -Data @{ name='web01'; status='online' }
        $result | Should -BeOfType 'System.Management.Automation.PSCustomObject'
        $result.PSTypeNames | Should -Contain 'PE.Server.Record.v1'
    }
}
```

---

## L.10 Reuse Across Teams

Encourage teams to build on shared foundations:

| Goal | Practice |
|------|-----------|
| Reuse logic | Reference existing Core modules |
| Keep scope small | One domain per module |
| Maintain contracts | Version output objects |
| Share documentation | Internal wiki or README.md |
| Enable discoverability | Consistent verbs and nouns |

---

## L.11 Summary

| Concept | Takeaway |
|----------|-----------|
| Composability | Small parts build large workflows |
| Reuse | Functions as shared building blocks |
| Contracts | Keep interfaces stable |
| Modularity | Split by responsibility, not convenience |
| Developer vs User Modules | Separate building blocks from dashboards |

> True reuse happens not when others copy your code,
> but when they **build on top of it** without needing to change it.

---

**End of Appendix L**

Return to [Appendix M — Cross-Team Versioning and Distribution](Appendix_M_Cross_Team_Versioning_and_Distribution.md)
