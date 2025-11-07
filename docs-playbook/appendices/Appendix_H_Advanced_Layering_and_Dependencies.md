---
id: appendix-h
title: Appendix H – Advanced Layering and Dependencies
sidebar_position: 8
description: In-depth look at layer interactions and dependency management.
---


> “A stable architecture isn’t rigid — it’s structured flexibility.”

This appendix provides a deep look into **PowerShell layering and dependency management**, explaining how to integrate **external modules**, **vendor SDKs**, and **internal shared modules** without violating architectural principles.

It extends Chapter 3 (*Layers and Responsibilities*) by focusing on real-world dependency flows and practical isolation strategies.

---

## H.1 Purpose

PowerShell scripts often grow by accretion — one function calls another, which calls a REST API, and soon the system becomes tangled.

Layered architecture introduces structure.
It ensures that **business logic and external systems are insulated** so each part can evolve independently.

We’ll explore:
- How layers interact and depend on one another.
- How to manage external dependencies from PSGallery and vendors.
- How to build internal modules that can be mixed, matched, and safely reused.

---

## H.2 The Layering Model (Refresher)

```
Context  →  Domain  →  Core
     ↑
  Adapter
```

| Layer | Description |
|--------|--------------|
| **Core** | Generic, pure utilities (retry, logging, URI) |
| **Domain** | Business logic and transformations |
| **Context** | User-facing workflows (CLI, automation entry points) |
| **Adapter** | Integration with external systems (REST, SDKs, files) |

Optional layers such as **Infrastructure** (shared persistence, secrets) or **Presentation** (UI/reporting) may be added in large systems.

---

## H.3 Dependency Direction

Dependencies always flow **downward**:

```
Context  →  Domain  →  Core
     ↑
  Adapter
```

The **Domain** never imports an Adapter.
The **Adapter** wraps real-world systems, converts data into a neutral domain format, and isolates volatility.

---

## H.4 The Role of Each Layer (Advanced)

### 1. Core
- **Purpose:** Provide reusable helpers with no domain awareness.
- **Nature:** Pure functions — deterministic, safe, testable.
- **Examples:** `Invoke-Retry`, `New-Uri`, `Write-Log`.
- **Allowed dependencies:** Pure utility modules (`PSFramework`, `PSScriptAnalyzer`, `ImportExcel`).

### 2. Domain
- **Purpose:** Express business rules, validation, and transformation.
- **Nature:** Pure; no external I/O.
- **Examples:** `ConvertTo-VMRecord`, `Test-VMIsRunning`.
- **Allowed dependencies:** Core only — no REST, no SDKs, no global state.

### 3. Adapter
- **Purpose:** Bridge to external APIs, SDKs, and data sources.
- **Nature:** Imperative — handles I/O, authentication, and normalization.
- **Examples:** `Invoke-NtxRequest`, `Connect-AzProvider`, `Read-FileMetadata`.
- **Allowed dependencies:** Vendor SDKs, CLI tools, REST endpoints.
- **Responsibility:** Never leak vendor objects to upper layers; always return normalized PSCustomObjects.

### 4. Context
- **Purpose:** Expose orchestration to users or automation systems.
- **Nature:** Declarative — combines domain and adapter logic.
- **Examples:** `Find-VM`, `Sync-Inventory`, `Repair-ClusterState`.
- **Allowed dependencies:** Domain + Core only. Never call vendor SDKs directly.

---

## H.5 Optional Layers in Complex Systems

```
Presentation
   ↓
Context
   ↓
Domain
   ↓
Infrastructure
   ↓
Core
↑
Adapter
```

- **Infrastructure:** Shared cross-cutting services such as persistence, secrets, caching, telemetry.
- **Presentation:** UI or reporting layer (WPF, HTML, dashboards).

These optional layers help scale large multi-module environments but follow the same dependency rule: *depend only downward.*

---

## H.6 External Dependencies and Where They Belong

| Type | Example | Layer | Reason |
|------|----------|-------|--------|
| Vendor SDK | `Az.Compute`, `VMware.PowerCLI`, `NutanixCmdlets` | Adapter | Network-bound, external state |
| Utility Module | `PSScriptAnalyzer`, `PSFramework` | Core | Pure, reusable logic |
| Data Tools | `ImportExcel`, `dbatools` | Core / Adapter | Depends on whether they read or transform |
| Testing Tools | `Pester` | Test Infrastructure | Never imported in runtime code |

---

## H.7 Dependency Isolation Patterns

### Pattern 1 — Adapter Wrapping

Encapsulate SDK calls inside private adapter functions.

```powershell
function Invoke-AzComputeQuery {
    [CmdletBinding()]
    param([string]$Name)
    Get-AzVM -Name $Name -Status
}
```

Upper layers depend only on the normalized interface:

```powershell
function ConvertTo-VMRecord {
    [CmdletBinding()]
    param([object]$Data)
    [PSCustomObject]@{
        Name       = $Data.Name
        Status     = $Data.PowerState
        PSTypeName = 'PE.Compute.VMRecord.v1'
    }
}
```

---

### Pattern 2 — Provider Dispatch

Use configuration or parameters to decide which provider to invoke.

```powershell
function Invoke-ProviderRequest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Provider,
        [hashtable]$Params
    )

    switch ($Provider) {
        'Azure'   { Get-AzVM @Params }
        'Nutanix' { Invoke-NtxRequest @Params }
        default   { throw "Unknown provider '$Provider'" }
    }
}
```

The **Context** function then stays provider-neutral.

---

### Pattern 3 — Normalization

Every adapter normalizes its output to your domain schema.

```powershell
# Azure
@{ Name = 'web01'; PowerState = 'Running' }

# Nutanix
@{ vmName = 'web01'; status = 'on' }

# Normalized (Domain)
[PSCustomObject]@{
    Name       = 'web01'
    Status     = 'Running'
    PSTypeName = 'PE.Compute.VMRecord.v1'
}
```

This allows all providers to be interchangeable.

---

## H.8 Internal Module Dependencies

Your own internal modules (e.g., `PE.Core`, `PE.Compute.Providers`) also obey the dependency direction.

| Source Module | Depends On | Example |
|----------------|-------------|----------|
| `PE.Server` | `PE.Compute.Discovery` | CLI orchestration |
| `PE.Compute.Discovery` | `PE.Compute.Core` | Domain transforms |
| `PE.Compute.Core` | `PE.Core` | Shared utilities |
| `PE.Compute.Providers` | `PE.Core` | REST helpers |

Declare internal dependencies via `RequiredModules` in `.psd1`, not by `Import-Module` inside code.

```powershell
# In PE.Compute.Discovery.psd1
RequiredModules = @('PE.Compute.Core', 'PE.Core')
```

This keeps dependency graphs predictable and build pipelines reproducible.

---

## H.9 Stability Model and Volatility

```
┌──────────────────────────────┐
│  Context  (frequent change)  │  User workflows
├──────────────────────────────┤
│  Domain   (moderate change)  │  Rules and contracts
├──────────────────────────────┤
│  Core     (stable)           │  Utilities, standards
├──────────────────────────────┤
│  Adapter  (volatile)         │  External APIs, SDKs
└──────────────────────────────┘
```

- The **Core** and **Domain** define stability.
- The **Adapter** isolates instability.
- The **Context** changes safely as business needs evolve.

---

## H.10 Testing and Dependency Isolation

Unit tests for **Core** and **Domain** layers should not require any external modules.

Mock all adapters:

```powershell
Mock Invoke-NtxRequest { @{ name='mock01'; power_state='on' } }
Mock Get-AzVM { @{ Name='mock01'; PowerState='Running' } }
```

This allows validation of logic and transformation independently of I/O.

Integration tests can validate adapters separately.

---

## H.11 Quick Reference — Where Dependencies Belong

| Layer | Allowed External Dependencies | Notes |
|--------|-------------------------------|-------|
| **Core** | Pure utilities (`PSFramework`, `ImportExcel`) | Deterministic, no I/O |
| **Domain** | None | Logic only |
| **Adapter** | Vendor SDKs (`Az.*`, `VMware.PowerCLI`) | Must normalize outputs |
| **Context** | Internal modules only | No vendor imports |
| **Infrastructure** | Secrets, cache libraries | Cross-cutting |
| **Presentation** | GUI/Reporting modules | No business logic |

---

## H.12 Configuration and Environment Overrides

### Principle
Configuration should drive behavior — not hardcoded logic.

### Common Strategies

| Type | Mechanism | Example |
|-------|------------|----------|
| **Static** | `.psd1` files under `/data/` | `Provider.Nutanix.psd1` |
| **Dynamic** | Environment variables | `$env:PE_ENVIRONMENT = 'Test'` |
| **Runtime** | Script variables or parameters | `-Cluster 'Prism'` |
| **Secret Storage** | DPAPI, Azure KeyVault, local vault | Credential persistence |

**Best Practice:**
Use environment variables for environment selection, psd1 files for defaults, and secrets for credentials.
This makes modules portable across Dev, QA, and Prod without code changes.

---

## H.13 Interacting with PSGallery and Third-Party Modules

| Integration Type | Example | Correct Layer | Reason |
|-------------------|----------|----------------|--------|
| REST Wrappers | `Invoke-RestMethod`, `Microsoft.Graph` | Adapter | I/O boundary |
| Utility | `PSScriptAnalyzer`, `PSFramework` | Core | Environment-independent |
| Infrastructure | `dbatools`, `ImportExcel` | Core / Adapter | Depends on usage |
| Authentication | `MSAL.PS`, `Az.Accounts` | Adapter / Infrastructure | Handles external state |

Never import third-party modules directly in **Domain** or **Context** layers.

---

## H.14 Layer Contract Summary

| Layer | Defines | Guarantees |
|--------|----------|-------------|
| **Core** | Function behavior | Deterministic, stateless |
| **Domain** | Object shape | Stable schema |
| **Adapter** | API mapping | Normalized output, graceful errors |
| **Context** | User interface | Predictable parameters and outputs |

These contracts let you swap layers or dependencies without breaking consumers.

---

## H.15 Example: Multi-Provider System

```
User (PE.Server)
  ├── Find-VM (Context)
  │     └── Invoke-ProviderRequest (Adapter)
  │           ├── AzureProvider.psm1  → Get-AzVM
  │           ├── NutanixProvider.psm1 → Invoke-NtxRequest
  │           └── VMwareProvider.psm1  → Get-VM
  └── ConvertTo-VMRecord (Domain)
         └── Invoke-Retry (Core)
```

Each provider adapter has its own dependencies.
The **Domain** and **Context** layers never change, even if a provider is added or removed.

---

## H.16 The Layer Inversion Checklist

| Question | Expected Answer |
|-----------|----------------|
| Can Domain/Core run without vendor SDKs? | ✅ Yes |
| Can Adapters be replaced without touching Domain? | ✅ Yes |
| Are Context commands consistent? | ✅ Yes |
| Are contracts stable? | ✅ Yes |
| Are dependencies declared downward only? | ✅ Yes |

Passing all checks means your PowerShell module architecture is resilient and compliant.

---

## H.17 Summary

| Concept | Rule |
|----------|------|
| Layers are dependency firewalls. | Each isolates a concern. |
| Core and Domain define stability. | Adapters absorb vendor change. |
| Configuration externalizes environment. | No hardcoding. |
| Internal modules follow the same rule. | Downward dependencies only. |
| PSGallery modules are treated as adapters or utilities. | Never leak types upward. |
| Normalization is key. | Consistent outputs across systems. |

---

**End of Appendix H**

Return to [Appendix I — Layer Theory, SOLID, and CQRS Integration](Appendix_I_Layer_Theory_SOLID_and_CQRS_Integration.md)
