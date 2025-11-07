---
id: core-concepts
title: Core Concepts
sidebar_position: 2
description: Introduces DDD, Clean Architecture, SOLID, CQRS, and Functional Core / Imperative Shell.
---

> “Architecture is not about adding complexity — it is about organizing simplicity.”

This chapter explains the foundational design principles that guide this playbook.
These concepts are drawn from software engineering disciplines such as **Domain-Driven Design (DDD)** and **Clean Architecture**, adapted to PowerShell’s procedural and modular nature.

---

## 2.1 Why Architecture Matters

Scripts without structure work in the short term — but they eventually collapse under their own weight.
Architecture gives us a mental model for keeping logic **organized**, **testable**, and **extensible**.

Without it, codebases typically degrade in predictable ways:

| Problem        | Symptom                                              | Result                 |
| -------------- | ---------------------------------------------------- | ---------------------- |
| No boundaries  | Functions mix API calls, data shaping, and UI output | Hard to test or modify |
| No contracts   | Different outputs for similar commands               | Breaking dependencies  |
| Tight coupling | Direct dependencies on APIs or file paths            | Difficult to change    |
| Repetition     | Same logic copied across scripts                     | Inconsistent results   |

Architecture helps us avoid these problems by enforcing **separation of concerns** — deciding _where_ code belongs and _what_ it should depend on.

---

## 2.2 Core Concept: Domain-Driven Design (DDD)

**Domain-Driven Design** encourages building software that reflects the _language and rules_ of your problem domain.

### In Practice (for PowerShell)

- The **domain** defines the nouns and verbs you work with.
- Code should be written in the **same language** that engineers use when discussing the system.
- Instead of writing a “generic script,” create functions that reflect business meaning.

**Example**

```powershell
# Poor abstraction
function Get-Data {
    Invoke-RestMethod -Uri 'https://api/service' | ConvertFrom-Json
}

# Domain-driven
function Get-VM {
    [CmdletBinding()]
    param([string]$Name)

    # Language aligns with domain
    $uri  = "https://api/vms?name=$Name"
    $data = Invoke-RestMethod -Uri $uri
    [PSCustomObject]@{
        Name   = $data.name
        Status = $data.status
    }
}
```

The second example is domain-aligned: it exposes **VMs**, not “data.”
The user’s intent is preserved, and the function becomes reusable in multiple contexts.

---

## 2.3 Core Concept: Clean / Hexagonal Architecture

Clean Architecture (sometimes called _Hexagonal_) describes how to structure code so that business logic is isolated from infrastructure such as REST APIs, SDKs, or files.

### Dependency Direction

```
 Context  →  Domain  →  Core
     ↑
  Adapter (API, SDK, CLI)
```

| Layer   | Responsibility                | Example                                   |
| ------- | ----------------------------- | ----------------------------------------- |
| Context | User-facing orchestration     | `Find-VM`                                 |
| Domain  | Core logic, validation, rules | `ConvertTo-VMRecord`                      |
| Core    | Pure, reusable utilities      | `Invoke-Retry`, `New-Uri`                 |
| Adapter | External dependencies         | `Invoke-NtxRequest`, `Connect-AzProvider` |

The **Domain** layer should never know about adapters like REST APIs.
Instead, it defines contracts or interfaces that adapters fulfill.

### Practical Example

```powershell
# Context: workflow
function Find-VM {
    param([string]$Name)
    $vmData = Invoke-NtxRequest -ApiPath "vms?name=$Name"
    ConvertTo-VMRecord -Data $vmData
}

# Domain: logic
function ConvertTo-VMRecord {
    param([object]$Data)
    [PSCustomObject]@{
        Name   = $Data.name
        Status = $Data.power_state
    }
}

# Core: helper
function Invoke-Retry {
    param([scriptblock]$Action, [int]$Attempts = 3)
    for ($i = 1; $i -le $Attempts; $i++) {
        try { return & $Action }
        catch { if ($i -eq $Attempts) { throw } }
    }
}
```

Each function focuses on **one layer** and **one responsibility**.

---

## 2.4 Core Concept: Command Query Separation (CQS / CQRS)

CQS (Command Query Separation) states:

> A function should either _query_ (return data) or _command_ (change state) — never both.

This principle is crucial for predictable PowerShell pipelines.

**Example**

```powershell
# ❌ Violates CQS — both reads and writes
function Get-OrCreateFolder {
    if (-not (Test-Path $Path)) { New-Item -Path $Path -ItemType Directory }
    Get-Item $Path
}

# ✅ Complies with CQS
function Get-Folder {
    Get-Item -Path $Path -ErrorAction SilentlyContinue
}

function New-Folder {
    if (-not (Test-Path $Path)) { New-Item -Path $Path -ItemType Directory }
}
```

Now each function does exactly one thing.
They can be combined in pipelines or reused independently.

---

## 2.5 Core Concept: Functional Core / Imperative Shell

This pattern separates:

- The **Functional Core** — pure transformations (no I/O, no side effects)
- The **Imperative Shell** — orchestration, I/O, and user interactions

**Example**

```powershell
# Functional Core
function ConvertTo-ServerRecord {
    [CmdletBinding()]
    param([string]$Name, [string]$State)
    [PSCustomObject]@{ Name = $Name; State = $State.ToUpper() }
}

# Imperative Shell
function Get-ServerRecord {
    [CmdletBinding()]
    param([string]$Name)
    $raw = Invoke-RestMethod "https://api/servers/$Name"
    ConvertTo-ServerRecord -Name $raw.name -State $raw.state
}
```

The “core” function can be **unit-tested** without touching the network.
The “shell” function is the **user-facing** part.

---

## 2.6 Core Concept: SOLID Principles (PowerShell-Adapted)

The SOLID principles were created for object-oriented languages but adapt well to function-based PowerShell.

| Principle                   | Summary                                     | PowerShell Practice                                          |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| SRP (Single Responsibility) | One reason to change                        | Each function does one thing.                                |
| OCP (Open/Closed)           | Open for extension, closed for modification | Add helpers or parameter sets; avoid editing existing logic. |
| LSP (Liskov Substitution)   | Derived entities must behave predictably    | Maintain consistent output contracts.                        |
| ISP (Interface Segregation) | Smaller, focused interfaces                 | Prefer small purpose-built commands.                         |
| DIP (Dependency Inversion)  | Depend on abstractions, not specifics       | Use helper functions or configuration, not hardcoded APIs.   |

**Example of SRP in Practice**

```powershell
# ❌ Mixed responsibilities
function Update-Server {
    Test-Connection $Server
    Set-ServerMode -Name $Server -Mode Maintenance
    Write-Host "Server $Server updated."
}

# ✅ Split by reason to change
function Test-ServerConnection { ... }
function Set-ServerMode { ... }
function Write-ServerUpdateMessage { ... }
```

This makes testing, debugging, and reuse straightforward.

---

## 2.7 PowerShell Architecture Summary Diagram

```
┌──────────────────────────────┐
│          Context              │
│  (User-facing workflows)      │
│   e.g., Find-VM, Sync-Server  │
└──────────────┬───────────────┘
               │
┌──────────────┴───────────────┐
│           Domain              │
│  (Rules, transforms, models)  │
│   e.g., ConvertTo-VMRecord    │
└──────────────┬───────────────┘
               │
┌──────────────┴───────────────┐
│             Core              │
│   (Utilities, helpers)        │
│   e.g., Invoke-Retry, New-Uri │
└──────────────┬───────────────┘
               │
┌──────────────┴───────────────┐
│           Adapter             │
│ (APIs, files, environment)    │
│  e.g., Invoke-NtxRequest      │
└──────────────────────────────┘
```

---

## 2.8 Quick Reference Checklist

When writing or reviewing a function, ask:

| Question                                   | Expectation         |
| ------------------------------------------ | ------------------- |
| Does it have one reason to change?         | Yes                 |
| Is it pure (no side effects)?              | If Core/Domain, yes |
| Does it handle I/O separately?             | Yes                 |
| Does it have a clear singular purpose?     | Yes                 |
| Can it be tested without external systems? | Ideally, yes        |
| Is the naming Verb-Noun and accurate?      | Always              |

---

## 2.9 Summary

| Concept              | Why It Matters                         | PowerShell Implication                       |
| -------------------- | -------------------------------------- | -------------------------------------------- |
| Domain-Driven Design | Express system rules in clear language | Name functions after domain actions          |
| Clean Architecture   | Keep dependencies flowing inward       | Layers determine where code lives            |
| CQRS                 | Predictable pipelines                  | Queries don’t modify state                   |
| Functional Core      | Testable and deterministic             | Pure transforms return PSCustomObjects       |
| SOLID                | Maintainability and composability      | Compose helpers; avoid editing big functions |

---

## Next Chapter

Continue to **Layers and Responsibilities** to see how these principles translate into concrete module structure and layering.
