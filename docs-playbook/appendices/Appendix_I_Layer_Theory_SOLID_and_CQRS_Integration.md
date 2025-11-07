---
id: appendix-i
title: Appendix I – Layer Theory, SOLID, and CQRS Integration
sidebar_position: 9
description: How DDD, SOLID, CQRS, and Clean Architecture integrate in PowerShell.
---


> “Architecture gives code purpose; principles give it discipline.”

This appendix explains **how DDD, Clean/Hexagonal Architecture, SOLID, CQRS, Functional Core/Imperative Shell, and Layered Design integrate** in a PowerShell engineering environment.
It connects *why* each principle exists to *how* they shape structure, testability, and extensibility in real-world automation modules.

---

## I.1 Overview

PowerShell modules that grow beyond a few scripts need deliberate structure — not for formality’s sake, but to make change *cheap* and intent *obvious*.

| Concept | Purpose | Outcome |
|----------|----------|----------|
| **Domain-Driven Design (DDD)** | Express business meaning directly in code | Shared vocabulary and intent |
| **Clean / Hexagonal Architecture** | Separate logic from implementation | Replaceable integrations |
| **SOLID** | Maintain code quality and extensibility | Testable and composable functions |
| **CQRS / CQS** | Separate reads from writes | Predictable, side-effect-free queries |
| **Functional Core / Imperative Shell** | Isolate pure logic from I/O | Deterministic, testable systems |
| **Layered Design** | Enforce dependency direction | Stable, evolvable module boundaries |

Each principle addresses a different dimension of system design:

- **DDD** — what your system *means*
- **Hexagonal** — where things *belong*
- **SOLID** — how things *change safely*
- **CQRS** — how things *behave*
- **Functional Core/Imperative Shell** — how things *execute*
- **Layers** — how everything *fits together*

---

## I.2 Domain-Driven Design (DDD) in PowerShell

DDD is the foundation for everything else: it ensures your code reflects the language and mental model of your domain.

Example:

```powershell
# ❌ Generic, unclear
function Get-Data { Invoke-RestMethod -Uri "https://api/v1/resource" }

# ✅ Domain-aligned
function Get-VM {
    [CmdletBinding()]
    param([string]$Name)
    $data = Invoke-RestMethod -Uri "https://api/v1/vms?name=$Name"
    [PSCustomObject]@{ Name = $data.name; Status = $data.status }
}
```

Here, *VM* is a domain entity.
By naming functions after the business concept, not the technical operation, you make code **self-documenting** and naturally reusable.

---

## I.3 Clean / Hexagonal Architecture Explained

The **Hexagonal Architecture** (also called **Ports and Adapters**) is a model where your core logic (domain) is surrounded by interchangeable interfaces (“ports”) and integrations (“adapters”).

### The Conceptual Model

```
           +----------------------------+
           |        Context Layer        |
           |   (User-facing workflows)   |
           +-------------+--------------+
                         |
           +-------------v--------------+
           |        Domain Layer         |
           |  (Rules, transforms, logic) |
           +-------------+--------------+
                         |
           +-------------v--------------+
           |         Core Layer          |
           | (Generic reusable utilities)|
           +-------------+--------------+
                         |
           +-------------v--------------+
           |       Adapters (I/O)        |
           |   (APIs, SDKs, Databases)   |
           +-----------------------------+
```

In Hexagonal Architecture:

- **Ports** are abstract entry/exit points (function contracts).
- **Adapters** are concrete implementations (like REST, SQL, or SDK).
- **Domain/Core** remain stable — they don’t care how data arrives.

This separation allows you to swap providers (e.g., Nutanix → Azure) without touching domain logic.

**In PowerShell Terms:**

| Role | Example Function | Responsibility |
|------|------------------|----------------|
| **Port** | `Invoke-ProviderRequest` | Defines how adapters communicate |
| **Adapter** | `Invoke-NtxRequest` | Implements the protocol (REST/SDK) |
| **Domain** | `ConvertTo-VMRecord` | Defines meaning and shape |
| **Context** | `Find-VM` | Orchestrates the workflow |

---

## I.4 SOLID Principles in PowerShell

| Principle | Description | PowerShell Example |
|------------|--------------|--------------------|
| **SRP** | One reason to change per function | Split `Update-Server` into `Test`, `Set`, and `Report` |
| **OCP** | Open for extension, closed for modification | Add new providers, don’t rewrite logic |
| **LSP** | Consistent substitutability | All `Get-VM` functions return same structure |
| **ISP** | Small, focused interfaces | Avoid multi-purpose “god” functions |
| **DIP** | Depend on abstractions | Wrap vendor APIs with adapter functions |

**Example:**

```powershell
# ❌ Monolithic
function Update-Server {
    Test-Connection $Server
    Set-ServerMode -Server $Server -Mode Maintenance
    Write-Host "Server updated."
}

# ✅ SOLID
function Test-ServerConnection { ... }
function Set-ServerMode { ... }
function Write-ServerUpdateMessage { ... }
```

Each function now has a single purpose, can be reused independently, and tested in isolation.

---

## I.5 CQRS (Command Query Responsibility Segregation)

CQRS ensures **behavioral clarity**:
- **Queries** (`Get-`, `Find-`, `Test-`) read data only.
- **Commands** (`Set-`, `New-`, `Remove-`) change state.
- **Transforms** (`ConvertTo-`, `Select-`) reshape data.

Example:

```powershell
function Get-Server { Get-Item "C:\Servers\$Name" }
function New-Server { New-Item "C:\Servers\$Name" }
function ConvertTo-ServerRecord { param($Data) [PSCustomObject]@{ Name = $Data.Name } }

Get-Server | ConvertTo-ServerRecord | Where-Object { $_.Status -eq 'Running' }
```

Each command’s behavior is predictable:
- `Get-Server` → pure query
- `New-Server` → idempotent state change
- `ConvertTo-ServerRecord` → pure transformation

This makes functions **composable** in pipelines and predictable in tests.

---

## I.6 Functional Core / Imperative Shell (Deep Dive)

This principle separates **pure computation** from **imperative control flow**.

| Component | Description | PowerShell Example |
|------------|--------------|--------------------|
| **Functional Core** | Pure functions that transform data. No I/O, no state. | `ConvertTo-VMRecord`, `New-ComputeODataFilter` |
| **Imperative Shell** | Orchestrates I/O: reads files, calls APIs, writes output. | `Find-VM`, `Invoke-NtxRequest` |

### Why It Matters
- **Predictability:** Core functions always return the same result for the same input.
- **Testability:** You can unit test the Core without mocks or dependencies.
- **Resilience:** The Shell can handle retries, logging, and failures separately.

### Example

```powershell
# Functional Core
function ConvertTo-UserRecord {
    param([object]$Data)
    [PSCustomObject]@{
        Name  = $Data.name
        Role  = $Data.role.ToUpper()
    }
}

# Imperative Shell
function Get-User {
    $raw = Invoke-RestMethod -Uri "https://api/users"
    ConvertTo-UserRecord -Data $raw
}
```

- **ConvertTo-UserRecord** is pure: it has no dependencies.
- **Get-User** is impure: it performs network I/O.
Together, they create a clean separation of logic and infrastructure.

---

## I.7 Layered Design — The Integration Point

Layered design unifies all prior principles into a practical structure.

| Layer | Emphasized Principle | Description |
|--------|----------------------|--------------|
| **Core** | Purity | Generic, reusable utilities |
| **Domain** | DDD + SOLID | System meaning, validation, transforms |
| **Adapter** | DIP + CQRS | Vendor integrations and I/O |
| **Context** | Clean Architecture | Orchestration and UX |
| **Infrastructure** | Reliability | Logging, secrets, persistence |
| **Presentation** | Readability | Human/UI formatting or reports |

Together, these layers enforce *one-way dependencies* — stable systems that evolve safely.

---

## I.8 How These Principles Reinforce Each Other

| Concept | What It Controls | Prevents |
|----------|------------------|-----------|
| **DDD** | Vocabulary | Confusing names |
| **Hexagonal** | Structure | Logic tied to APIs |
| **SOLID** | Code quality | Monoliths |
| **CQRS** | Behavior | Mixed query/command confusion |
| **Functional Core** | Purity | Hidden side effects |
| **Layered Design** | Organization | Circular dependencies |

These principles are **not competing** — they are complementary.
They create systems that are **predictable, testable, and maintainable**.

---

## I.9 Example Integration: “Find All Running Servers”

```
Find-Server (Context)
│
├── ConvertTo-ServerRecord (Domain)
│     └── Invoke-ProviderRequest (Adapter)
│           └── Invoke-RestRequest (Core)
```

Concept Applications:
- **DDD:** “Server” is the business noun.
- **CQRS:** Find-Server is a query.
- **SOLID:** Each function has a single reason to change.
- **Functional Core:** Conversion logic is pure.
- **Hexagonal:** REST is isolated in the Adapter.

---

## I.10 Stability and Change Zones

```
┌────────────────────────────┐
│  Context (volatile)        │  Features, UX, CLI behavior
├────────────────────────────┤
│  Domain (moderate)         │  Rules, transforms, data contracts
├────────────────────────────┤
│  Core (stable)             │  Utilities, helpers, logging
├────────────────────────────┤
│  Adapter (volatile)        │  Vendor APIs, SDKs, network
└────────────────────────────┘
```

- The **Core** and **Domain** are stable anchors.
- The **Adapter** and **Context** absorb volatility.
- This balance allows systems to change without cascading rewrites.

---

## I.11 Summary

| Principle | Focus | Core Rule |
|------------|--------|-----------|
| **DDD** | Vocabulary and meaning | Code mirrors the business domain |
| **Hexagonal Architecture** | Separation of logic and integrations | Core never depends on APIs |
| **SOLID** | Design quality | One reason to change per function |
| **CQRS** | Behavioral separation | Don’t mix reads and writes |
| **Functional Core/Imperative Shell** | Purity and control | Transform first, orchestrate later |
| **Layered Design** | Structural organization | Depend only downward |

> These principles turn PowerShell from a scripting tool into an engineering discipline —
> where logic is clean, systems are composable, and change becomes safe.

---

**End of Appendix I**

