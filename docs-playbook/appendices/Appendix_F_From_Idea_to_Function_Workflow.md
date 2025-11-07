---
id: appendix-f
title: Appendix F – From Idea to Function / Module Workflow
sidebar_position: 6
description: Step-by-step design process for new functions and modules.
---

> “Good engineering is a process, not a guess.”

This appendix defines a **repeatable workflow** for transforming a raw idea or feature request into a fully realized PowerShell function or module.
It provides a structured approach to thinking, designing, and implementing with clarity and purpose — ensuring every function is reliable, reusable, and aligned with your architecture.

---

## F.1 Purpose

This process answers one central question:

> “How do we go from *what we need* to *how we build it* — without creating a mess?”

It helps engineers:
- Think critically before coding.
- Design predictable, testable contracts.
- Choose the correct layer for logic.
- Maintain long-term extensibility and consistency.

By following this workflow, the team ensures every new function or module begins with **clear intent**, **defined boundaries**, and **consistent structure**.

---

## F.2 Overview: The Eight-Step Workflow

```
┌───────────────────────────────────┐
│ 1. Define the Problem             │ → What are we solving?
├───────────────────────────────────┤
│ 2. Identify Entities and Domain   │ → What nouns and verbs describe it?
├───────────────────────────────────┤
│ 3. Define Inputs, Outputs, and Constraints │ → What comes in, what goes out?
├───────────────────────────────────┤
│ 4. Choose the Correct Layer       │ → Core, Domain, Adapter, or Context.
├───────────────────────────────────┤
│ 5. Draft the Contract             │ → Inputs, outputs, behavior type.
├───────────────────────────────────┤
│ 6. Implement Iteratively          │ → Pure logic first, side effects last.
├───────────────────────────────────┤
│ 7. Test, Validate, and Review     │ → Unit, integration, contract testing.
├───────────────────────────────────┤
│ 8. Document and Organize          │ → Help text, folder placement, versioning.
└───────────────────────────────────┘
```

---

## F.3 Step 1 — Define the Problem

Start by writing a **clear problem statement**, not a solution.

### Example
> “We need to check which virtual machines (VMs) are powered off in each cluster.”

Avoid jumping to “we’ll query Nutanix” — first understand *why* the feature is needed and *what information* must be surfaced.

### Problem Definition Template
| Question | Example Answer |
|-----------|----------------|
| What is the desired outcome? | List all powered-off VMs. |
| Who will use it? | System administrators monitoring resources. |
| Why is it needed? | To identify unused compute capacity. |
| Where does it apply? | Across all Nutanix clusters. |

### Output of this step
A short paragraph describing the intent and context, like a user story:

> As a system administrator, I want to list all powered-off VMs across clusters so that I can identify idle compute capacity.

---

## F.4 Step 2 — Identify Entities and Domain

Every problem lives within a **domain** — a group of related nouns (things) and verbs (actions).
Identifying them early shapes your **language, function names, and data models**.

### Example Analysis
| Type | Example | Description |
|-------|----------|-------------|
| Entity | VM | A virtual machine, the primary object. |
| Entity | Cluster | A group of VMs, defines environment scope. |
| Entity | Provider | Nutanix, Azure, VMware. |
| Verb | Find | Search, read-only. |
| Verb | Test | Predicate or validation. |
| Verb | Sync | State reconciliation. |

**Result:**
Your function vocabulary comes directly from these nouns and verbs — e.g., `Find-VM`, `Test-ClusterHealth`, `Sync-Inventory`.

---

## F.5 Step 3 — Define Inputs, Outputs, and Constraints

This step forms the foundation of your **contract** — the function’s promise.

### Inputs
Ask:
- What information must the user provide?
- What can be defaulted from environment/config?
- Which inputs should be optional vs. mandatory?

Example:

| Parameter | Required | Type | Description |
|------------|-----------|------|--------------|
| `-Cluster` | Yes | String | Cluster name to query. |
| `-PowerState` | No | String (`On`/`Off`) | Filter for VM state. |
| `-Provider` | No | String | Cloud or on-prem system. |

### Outputs
Ask:
- What object(s) will the function return?
- What properties must always exist?

Example Output (record structure):

| Property | Type | Description |
|-----------|------|--------------|
| `Name` | String | VM name |
| `Cluster` | String | Cluster name |
| `PowerState` | String | Current state |
| `Provider` | String | Source provider |
| `PSTypeName` | String | Versioned type identifier |

### Constraints
Ask:
- Are there dependencies (e.g., API credentials, file paths)?
- Does the function modify external state (network, file, API)?
- Are there performance or environment limitations?

Capture these in a short checklist for reviewers.

---

## F.6 Step 4 — Choose the Correct Layer

Your layer determines *where* the logic lives.

| Layer | Responsibility | Example Function | Notes |
|--------|----------------|------------------|-------|
| **Core** | Generic utilities, pure logic | `Invoke-Retry`, `Write-Log` | No external dependencies. |
| **Domain** | Transformations, validation, data shaping | `ConvertTo-VMRecord` | Pure functions only. |
| **Adapter** | API, SDK, or file I/O | `Invoke-NtxRequest`, `Get-FileData` | Handles side effects. |
| **Context** | Orchestration and UX | `Find-VM`, `Sync-Inventory` | Combines layers. |

### Rule of Thumb
- If it **calculates** → Domain.
- If it **fetches or writes** → Adapter.
- If it **coordinates** → Context.
- If it **helps everyone** → Core.

---

## F.7 Step 5 — Draft the Contract

Write the contract as if it were a “mini-spec” for your function.

### Function Contract Template
| Field | Example |
|--------|----------|
| **Function Name** | `Find-VM` |
| **Verb Type** | Query |
| **Layer** | Context |
| **Inputs** | `-Cluster`, `-PowerState` |
| **Output Type** | `PE.Compute.VMRecord.v1` |
| **Side Effects** | None (read-only) |
| **Errors** | Throws on invalid provider or timeout. |
| **Behavior Guarantee** | Returns one record per VM. |

This becomes both the **design reference** and your **Pester contract test** later.

---

## F.8 Step 6 — Implement Iteratively

Start small and pure — build one layer at a time.

### Step-by-step Implementation

1. **Domain (pure logic)**
```powershell
function ConvertTo-VMRecord {
    param([object]$Raw)
    [PSCustomObject]@{
        PSTypeName = 'PE.Compute.VMRecord.v1'
        Name       = $Raw.name
        PowerState = $Raw.power_state
        Cluster    = $Raw.cluster_name
    }
}
```

2. **Adapter (API access)**
```powershell
function Invoke-NtxRequest {
    param([string]$Uri, [PSCredential]$Credential)
    Invoke-RestMethod -Uri $Uri -Headers @{ Authorization = "Basic ..." }
}
```

3. **Context (user-facing orchestration)**
```powershell
function Find-VM {
    [CmdletBinding()]
    param([string]$Cluster, [string]$PowerState)

    $uri = "https://api/cluster/$Cluster/vms"
    $data = Invoke-NtxRequest -Uri $uri
    $records = $data | Where-Object { $_.power_state -eq $PowerState }
    $records | ForEach-Object { ConvertTo-VMRecord -Raw $_ }
}
```

**Why this order matters:**
It allows early unit testing of the Domain before any real I/O occurs.

---

## F.9 Step 7 — Test, Validate, and Review

At minimum, each function should have **three levels of testing**:

| Level | Example | Goal |
|--------|----------|------|
| **Unit** | Test `ConvertTo-VMRecord` with sample JSON. | Verify logic correctness. |
| **Integration** | Mock `Invoke-RestMethod` in `Invoke-NtxRequest`. | Validate API call behavior. |
| **Contract** | Ensure `Find-VM` returns consistent property names. | Maintain interface stability. |

Use Pester’s `Should -Be` for deterministic checks and versioned `PSTypeName` for identity.

---

## F.10 Step 8 — Document and Organize

Before merging:
1. Add **comment-based help** (see Appendix E).
2. Update the module manifest (`.psd1`).
3. Place the file under the correct folder:

```
PE.Compute.Common/
  Public/Find-VM.ps1
  Private/Domain/ConvertTo-VMRecord.ps1
  Private/Adapter/Invoke-NtxRequest.ps1
```

4. Commit with a descriptive message:
> “Add Find-VM workflow (Context) and supporting Domain/Adapter layers.”

5. Tag with a semantic version bump (see Chapter 10).

---

## F.11 Template: Idea-to-Function Worksheet

Use this template when designing new features.

### 1. Problem Statement
_(Write one or two sentences describing what this function must achieve.)_

### 2. Domain Vocabulary
| Entity | Verb | Notes |
|---------|-------|-------|
|         |       |       |
|         |       |       |

### 3. Inputs / Outputs
| Name | Type | Required | Description |
|------|------|-----------|-------------|
|      |      |           |             |

### 4. Constraints
_(Dependencies, security, timing, environment variables, etc.)_

### 5. Layer Placement
☐ Core  ☐ Domain  ☐ Adapter  ☐ Context

### 6. Contract Summary
| Field | Description |
|--------|-------------|
| Function Name |  |
| Verb Type |  |
| Input Parameters |  |
| Output Type |  |
| Side Effects |  |
| Errors |  |

### 7. Test Plan
- [ ] Unit test scenarios
- [ ] Integration mock setup
- [ ] Contract property checks

### 8. Documentation Tasks
- [ ] Comment-based help
- [ ] Example usage
- [ ] Linked wiki reference

---

## F.12 How These Steps Influence Design

| Design Element | Influenced By | Description |
|-----------------|---------------|--------------|
| **Contracts** | Steps 3–5 | Inputs, outputs, and guarantees define stability. |
| **Behavior** | Steps 2 + 5 | Verb/noun choice and function type dictate pipeline behavior. |
| **Organization** | Step 4 | Layer choice determines file location and dependency direction. |
| **Extensibility** | Step 6 + 7 | Modular design allows future providers or data sources. |
| **Documentation** | Step 8 | Help text mirrors the contract — your function’s public promise. |

---

## F.13 Example Walkthrough (Condensed)

### Feature
> “Sync all active VMs from Nutanix clusters into a local cache.”

| Step | Result |
|------|---------|
| **1. Problem** | Need to synchronize VM metadata. |
| **2. Entities** | VM, Cluster, Cache. |
| **3. Inputs/Outputs** | Inputs: Cluster, Provider; Output: cached record list. |
| **4. Layer** | Context (`Sync-VMInventory`). |
| **5. Contract** | Query + Mutator hybrid (read and update local cache). |
| **6. Implementation** | Calls `Invoke-NtxRequest` (Adapter) + `Write-CacheItem` (Core). |
| **7. Tests** | Unit test caching logic, mock REST. |
| **8. Documentation** | Added `.EXAMPLE` and wiki link. |

---

## F.14 Summary

| Step | Key Question | Deliverable |
|------|---------------|-------------|
| 1 | What are we solving? | Problem statement |
| 2 | What’s the domain? | Vocabulary of nouns/verbs |
| 3 | What comes in/out? | Contract definition |
| 4 | Where does it live? | Layer selection |
| 5 | What’s the behavior? | Verb–noun definition |
| 6 | How to implement cleanly? | Incremental build plan |
| 7 | How do we prove it works? | Tests |
| 8 | How do we share it? | Documentation + module integration |

Following this workflow standardizes how new functions evolve — turning feature ideas into maintainable, testable, and version-safe code.

---

**End of Appendix F**

Continue to [Appendix A — Common Patterns and Anti-Patterns](Appendix_A_Common_Patterns_and_AntiPatterns.md)
