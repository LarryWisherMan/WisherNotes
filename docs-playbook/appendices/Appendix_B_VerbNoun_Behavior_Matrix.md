---
id: appendix-b
title: Appendix B – Verb–Noun Reference and Behavior Matrix
sidebar_position: 2
description: Approved verbs, naming standards, and behavioral categories.
---

> “Consistency is the foundation of discoverability.”

This appendix defines how verbs and nouns communicate intent in PowerShell engineering.
It provides an authoritative mapping between **verb categories** and **function behavior types**, ensuring every public function in your modules behaves consistently.

---

## B.1 Purpose

In PowerShell, verbs are more than names — they define **contracts** for behavior.

For example:
- `Get-Item` promises to retrieve data without modifying state.
- `Set-Item` promises to modify state and respect `-WhatIf`.
- `Test-Path` promises to return a Boolean.

When developers follow these conventions, users can predict how a command behaves — even before reading the code.

---

## B.2 Verb Categories and Core Behavior

| Verb Category | Behavior Type | Description |
|----------------|----------------|--------------|
| **Query** | Read-only | Returns data without side effects. |
| **Transform** | Data shaping | Converts or filters input data. |
| **Predicate** | Boolean evaluation | Returns `$true` or `$false`. |
| **Mutator** | State-changing | Creates, modifies, or deletes resources. |
| **Presenter** | Display/logging | Formats or outputs data for users. |
| **Utility** | Execution/flow control | Invokes scripts, retries, or orchestration logic. |

Each of these maps to one or more approved verbs.

---

## B.3 Query Verbs

Query verbs retrieve or list existing information.
They must never modify system state and should return **objects**, not formatted text.

| Verb | Example Function | Expected Behavior |
|-------|------------------|-------------------|
| `Get` | `Get-VM` | Retrieve existing objects. |
| `Find` | `Find-Cluster` | Search/filter by condition. |
| `Resolve` | `Resolve-Host` | Map logical name to address. |
| `List` | `List-Provider` | Enumerate available entities. |
| `Export` | `Export-Report` | Output data in a serializable form. |

**Rules**
- Output must be consistent PSCustomObjects.
- No `Write-Host` or `Format-*` usage.
- Should support pipeline input/output.
- No state modification (pure query).

---

## B.4 Transform Verbs

Transform verbs modify or reshape data — without external effects.
These functions are pure: they should depend only on their input.

| Verb | Example Function | Expected Behavior |
|-------|------------------|-------------------|
| `ConvertTo` | `ConvertTo-VMRecord` | Change representation or type. |
| `Select` | `Select-ClusterSummary` | Project only specific properties. |
| `Merge` | `Merge-InventoryData` | Combine multiple inputs. |
| `Expand` | `Expand-Path` | Unpack structured data. |

**Rules**
- Always return new data — do not modify the input directly.
- Avoid external dependencies.
- Testable in isolation (unit-test friendly).

---

## B.5 Predicate Verbs

Predicate verbs answer a question.
They must always return `$true` or `$false` — and nothing else.

| Verb | Example Function | Expected Behavior |
|-------|------------------|-------------------|
| `Test` | `Test-VMIsRunning` | Boolean result from logical check. |
| `Compare` | `Compare-Config` | Evaluate difference, return Boolean or summary. |
| `Check` | `Check-Connection` | Validate conditions, return Boolean. |
| `Assert` | `Assert-ValidInput` | Throw on violation (testing context). |

**Rules**
- Must return `[bool]`.
- Should never write objects to output stream.
- Must not alter state.

---

## B.6 Mutator Verbs

Mutators create, modify, or delete resources.
They are the only verbs allowed to cause **state changes** and must respect `-WhatIf` and `-Confirm`.

| Verb | Example Function | Expected Behavior |
|-------|------------------|-------------------|
| `New` | `New-Cluster` | Create a new resource. |
| `Set` | `Set-ClusterMode` | Modify an existing resource. |
| `Remove` | `Remove-VM` | Delete an entity. |
| `Enable` | `Enable-ClusterProtection` | Turn a feature on. |
| `Disable` | `Disable-ClusterProtection` | Turn a feature off. |
| `Start` | `Start-VM` | Begin operation or process. |
| `Stop` | `Stop-VM` | End operation or process. |

**Rules**
- Use `[CmdletBinding(SupportsShouldProcess=$true)]`.
- Wrap state-changing actions in `if ($PSCmdlet.ShouldProcess(...)) { ... }`.
- Log actions with `Write-Verbose`, not `Write-Host`.
- Return objects summarizing the change.

---

## B.7 Presenter Verbs

Presenter verbs output or display data to the user or log — not to the pipeline for reuse.

| Verb | Example Function | Expected Behavior |
|-------|------------------|-------------------|
| `Write` | `Write-Log` | Emit messages to standard streams. |
| `Show` | `Show-ClusterReport` | Display formatted output. |
| `Format` | `Format-InventoryTable` | Prepare human-readable display. |

**Rules**
- Should not return objects (return nothing or `$null`).
- Use PowerShell streams appropriately (`Write-Verbose`, `Write-Error`, etc.).
- Suitable for UI or report layers.

---

## B.8 Utility Verbs

Utility verbs perform orchestration, coordination, or invocation.

| Verb | Example Function | Expected Behavior |
|-------|------------------|-------------------|
| `Invoke` | `Invoke-ComputeRestRequest` | Execute an operation or call. |
| `Measure` | `Measure-ClusterUsage` | Quantify or calculate. |
| `Start` | `Start-JobRun` | Begin background operation. |
| `Stop` | `Stop-JobRun` | Halt background operation. |

**Rules**
- Should focus on *execution*, not *state storage*.
- Return result objects or metrics.
- Keep side effects explicit.

---

## B.9 Verb Conflicts and Ambiguity

**Avoid ambiguous verbs**, which hide intent:

| Problematic Verb | Issue | Recommended Replacement |
|------------------|--------|--------------------------|
| `Run` | Too generic | `Invoke` |
| `Do` | No implied behavior | `Invoke`, `Start`, or `Set` |
| `Make` | Nonstandard | `New` |
| `Build` | Ambiguous | `New` or `ConvertTo` |
| `Check` | Ambiguous (use only for internal testing) | `Test` |
| `Process` | Conflicts with pipeline keyword | `ConvertTo` or `Invoke` |

---

## B.10 Naming Nouns

Nouns define **domain entities** — the objects your module works with.
They should be singular, precise, and domain-aligned.

**Good**
```
Get-VM
Find-Cluster
ConvertTo-ServerRecord
Test-VMIsRunning
```

**Bad**
```
Get-VMs          # plural noun (avoid)
Find-Data        # ambiguous noun
Do-Operation     # unclear purpose
```

**Rules**
- Singular nouns only (PowerShell convention).
- Avoid generic nouns (`Item`, `Data`, `Thing`).
- Reflect actual business or domain entity (`VM`, `Cluster`, `Session`, `Inventory`).

---

## B.11 Behavior Matrix

| Verb | Behavior Type | Returns | State Change | ShouldProcess | Typical Layer |
|-------|----------------|----------|----------------|----------------|----------------|
| Get | Query | Object(s) | No | No | Context / Domain |
| Find | Query | Object(s) | No | No | Context |
| Resolve | Query | Object(s) | No | No | Adapter / Domain |
| ConvertTo | Transform | Object | No | No | Domain / Core |
| Select | Transform | Object | No | No | Domain |
| Test | Predicate | Boolean | No | No | Domain |
| Compare | Predicate | Boolean/Object | No | No | Domain |
| New | Mutator | Object | Yes | Yes | Context / Adapter |
| Set | Mutator | Object | Yes | Yes | Context / Adapter |
| Remove | Mutator | Object | Yes | Yes | Context / Adapter |
| Write | Presenter | None | No | No | Core / Context |
| Show | Presenter | None | No | No | Context |
| Invoke | Utility | Object | Optional | Optional | Core / Adapter |
| Measure | Utility | Object | No | No | Domain |

---

## B.12 Verb Selection Flow

```
Start: What does your function do?
│
├─► Reads data only? ─► Use "Get" or "Find"
│
├─► Converts input to another form? ─► Use "ConvertTo" or "Select"
│
├─► Returns Boolean? ─► Use "Test"
│
├─► Changes state or configuration? ─► Use "Set", "New", or "Remove"
│
├─► Produces human-readable output? ─► Use "Write" or "Show"
│
└─► Executes process or API? ─► Use "Invoke"
```

---

## B.13 Summary

| Principle | Rule |
|------------|------|
| Use verbs to signal intent | Users should know behavior by name alone. |
| Follow PowerShell’s approved verbs | Align with built-in conventions for discoverability. |
| Pair verbs with precise nouns | Build a clear, domain-specific vocabulary. |
| Enforce behavior contracts | Each verb implies a strict I/O pattern. |
| Keep it predictable | Predictability drives composability and trust. |

---

**Next Appendix →**
[Appendix C — Pester Test Templates](Appendix_C_Pester_Test_Templates.md)
