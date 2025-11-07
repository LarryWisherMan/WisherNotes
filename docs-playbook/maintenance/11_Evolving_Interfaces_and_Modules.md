---
id: evolving-interfaces-and-modules
title: Evolving Interfaces and Modules
sidebar_position: 11
description: Designing additive evolution paths and avoiding breaking changes.
---

> “Change is inevitable. Breaking change is optional.”

This chapter explains how to evolve PowerShell modules gracefully — preserving trust and predictability as your system grows.
Evolution isn’t just adding new features; it’s the _systematic, backward-compatible adaptation_ of existing code to meet new needs.

---

## 11.1 The Nature of Change in PowerShell Modules

Every live automation system changes.
New providers are added, APIs evolve, teams refactor.
Unmanaged change, however, destroys stability.

Common pain points:

| Change Type         | Risk                | Example                                    |
| ------------------- | ------------------- | ------------------------------------------ |
| Parameter rename    | Breaks user scripts | `-ServerName` → `-Name`                    |
| Output field rename | Breaks pipelines    | `Status` → `PowerState`                    |
| Module split        | Breaks imports      | `Import-Module PE.Compute` no longer works |
| Provider API update | Breaks adapters     | New URI schema                             |

Sustainable systems manage change through versioning, layering, and controlled deprecation.

---

## 11.2 The Goal: Predictable Evolution

Predictable evolution means **your users can trust that their scripts will keep working** after updates.
Your module becomes a stable platform, not a moving target.

### Key Practices

1. **Stable contracts:** Input/output behavior doesn’t change silently.
2. **Additive features:** New capabilities coexist with old ones.
3. **Layered refactors:** Internal improvements don’t leak to the public API.
4. **Explicit communication:** Breaking changes are versioned and documented.

---

## 11.3 The PowerShell Contract Model

Every public function has a _contract_ — the agreed-upon rules between the function and its caller.

```
┌────────────────────────────┐
│        Public Function      │
├────────────────────────────┤
│ Parameters → Input Contract │
│ Output → Output Contract    │
│ Behavior → Semantic Contract│
└────────────────────────────┘
```

### Contract Types

| Type                    | Description                    | Example                                      |
| ----------------------- | ------------------------------ | -------------------------------------------- |
| **Parameter Contract**  | Names, types, semantics        | `-Names` accepts `[string[]]`                |
| **Output Contract**     | Shape and type of result       | Returns `[PSCustomObject]` with Name, Status |
| **Error Contract**      | What and how errors are thrown | Uses `Write-Error`, not `Write-Host`         |
| **Behavioral Contract** | What it promises to do         | `Find-VM` only queries, never modifies state |

Maintaining contracts is the foundation of stability.

---

## 11.4 Semantic Versioning (Recap and Deep Dive)

Semantic Versioning (SemVer) governs how and when changes are released.

```
MAJOR.MINOR.PATCH
```

| Level     | Impact   | Example                             |
| --------- | -------- | ----------------------------------- |
| **MAJOR** | Breaking | Rename parameter or output property |
| **MINOR** | Additive | New optional switch or helper       |
| **PATCH** | Internal | Refactor, performance, or bug fix   |

**Golden Rule:**
If an existing script breaks, you made a **MAJOR** change — even if you think it’s “small.”

### Example: Version Bump Flow

```
1.0.0  → Initial stable release
1.1.0  → Added new parameter -IncludeSnapshots
1.1.1  → Fixed pagination bug
2.0.0  → Changed output schema (breaking)
```

---

## 11.5 Evolving Parameters Safely

Renaming or removing parameters is the most common breaking change.
Use **aliases** and **parameter sets** to evolve gracefully.

### Example: Non-breaking rename

```powershell
function Get-Server {
    [CmdletBinding()]
    param(
        [Alias('ServerName')]
        [string]$Name
    )
}
```

### Example: Adding new behavior

```powershell
function Get-Server {
    [CmdletBinding(DefaultParameterSetName = 'Default')]
    param(
        [Parameter(ParameterSetName='Default')]
        [string]$Name,
        [Parameter(ParameterSetName='Filter')]
        [string]$Filter
    )
}
```

Avoid removing parameters — mark them **deprecated** first.

---

## 11.6 Deprecation Workflow

Deprecation is the bridge between “old” and “new” — it gives users time to adjust.

### Example Pattern

```powershell
function Get-Server {
    [CmdletBinding()]
    param(
        [string]$Name,
        [string]$OldParam
    )

    if ($PSBoundParameters.ContainsKey('OldParam')) {
        Write-Warning "Parameter -OldParam is deprecated and will be removed in v2.0.0. Use -Name instead."
        $Name = $OldParam
    }

    # Continue normal execution
}
```

### Deprecation Process

1. Announce deprecation in **release notes**.
2. Show clear warnings in console (non-terminating).
3. Maintain backward compatibility for at least one **MINOR** version.
4. Remove only in a **MAJOR** version.

---

## 11.7 Managing Output Evolution

Output shape changes can be even more disruptive than parameter changes.

### Unsafe

```powershell
# Old
[PSCustomObject]@{ Name = "web01"; Status = "Running" }

# New (breaking)
[PSCustomObject]@{ Host = "web01"; PowerState = "Running" }
```

### Safe

Additive instead of destructive:

```powershell
[PSCustomObject]@{
    Name       = "web01"
    Status     = "Running"
    PowerState = "Running"  # New, optional
    PSTypeName = "PE.Compute.VMRecord.v2"
}
```

**Key:** Version the _type_, not the property names.

---

## 11.8 Versioning with PSTypeNames

Use `PSTypeNames` to signal type evolution to downstream consumers.

### Example

```powershell
$record = [PSCustomObject]@{
    Name       = "web01"
    Status     = "Running"
    PSTypeName = "PE.Compute.VMRecord.v1"
}
```

When you extend the schema:

```powershell
$record.PSTypeNames.Insert(0, 'PE.Compute.VMRecord.v2')
```

Consumers can detect changes via:

```powershell
if ($record.PSTypeNames -contains 'PE.Compute.VMRecord.v2') {
    # handle new schema
}
```

This avoids breaking scripts relying on older versions.

---

## 11.9 Splitting and Bundling Modules

As projects grow, some modules become too large.
Splitting them can improve clarity — but must be handled carefully.

### Common Evolution Pattern

```
PE.Compute.Common/
   ↓
PE.Core/
PE.Compute.Core/
PE.Compute.Providers/
PE.Compute.Discovery/
```

Use **nested modules** or **bundled imports** to preserve a single import point.

### Example: Bundled entry point

```powershell
# PETools.psm1
Import-Module PE.Core
Import-Module PE.Compute.Core
Import-Module PE.Compute.Providers
Export-ModuleMember -Function * -Alias *
```

Users continue importing `PETools`, even as the internal structure evolves.

---

## 11.10 Evolving Provider Adapters

Providers (like Azure, Nutanix, VMware) evolve independently.
Each should maintain its own configuration and versioning.

### Folder Pattern

```
Private/Providers/
  Nutanix/
  Azure/
  VMware/
```

Each subfolder contains:

- `Provider.<Name>.psd1` — configuration
- `Invoke-<Name>Request.ps1` — core adapter
- `New-<Name>Session.ps1` — authentication logic

When adding a new provider:

1. Add new folder and config.
2. No modification to existing code.
3. Update build script to include new provider module.

---

## 11.11 Migration via Composition

Prefer _migration by composition_ instead of replacement.

### Example: Migration Wrapper

```powershell
function Get-ServerInfo {
    [CmdletBinding()]
    param([string]$Name)

    # Old logic
    $legacy = Get-Server -Name $Name

    # New logic
    $extra = Get-ServerDetails -Name $Name

    [PSCustomObject]@{
        Name   = $legacy.Name
        Status = $legacy.Status
        CPU    = $extra.CPU
    }
}
```

This ensures new functions extend, not break, old functionality.

---

## 11.12 Communicating Change

Version changes are only useful if users understand them.

| Channel                  | Purpose           | Example                                           |
| ------------------------ | ----------------- | ------------------------------------------------- |
| **CHANGELOG.md**         | Technical summary | “v1.3.0 – Added provider authentication caching.” |
| **Help files**           | Usage guidance    | Update `.SYNOPSIS` and `.EXAMPLE`                 |
| **Release Notes**        | Business context  | “New provider support; no breaking changes.”      |
| **Deprecation warnings** | Runtime awareness | “This parameter will be removed in v2.0.”         |

Always document:

- What changed
- Why it changed
- How to migrate

---

## 11.13 Testing for Compatibility

Automate backward compatibility checks:

- Run tests from previous versions against the new module.
- Use contract tests (e.g., `Find-VM` still returns `Name` and `Status`).
- Mock old parameter names to verify aliases still work.

### Example

```powershell
Describe "Backward Compatibility" {
    It "Accepts legacy parameter names" {
        $result = Get-Server -ServerName "web01"
        $result.Name | Should -Be "web01"
    }
}
```

---

## 11.14 Controlled Deprecation Timeline

Deprecation is a _process_, not an event.

```
Version 1.3.0 — Add new parameter (-Name)
Version 1.4.0 — Warn if using old (-ServerName)
Version 2.0.0 — Remove deprecated parameter
```

Document this timeline clearly in your changelog and PRs.

---

## 11.15 Evolution Review Checklist

| Category         | Question                                     | Expectation |
| ---------------- | -------------------------------------------- | ----------- |
| **Contracts**    | Are parameter and output contracts stable?   | Yes         |
| **Deprecations** | Are old names still supported with warnings? | Yes         |
| **PSTypeNames**  | Are types versioned clearly?                 | Yes         |
| **Tests**        | Do compatibility tests cover legacy usage?   | Yes         |
| **Docs**         | Are changes documented?                      | Yes         |
| **Versioning**   | Does version bump match impact?              | Yes         |

---

## 11.16 Summary

| Concept         | Practice                                             |
| --------------- | ---------------------------------------------------- |
| Contracts       | Treat parameters and outputs as immutable agreements |
| SemVer          | Communicate impact and evolution clearly             |
| Deprecation     | Phase out safely through warnings                    |
| Bundling        | Maintain simple import paths for users               |
| Provider growth | Add, don’t modify existing adapters                  |
| Communication   | Always document why and how change occurs            |
| Compatibility   | Test old workflows against new versions              |

---

## Next Chapter

Continue to **Chapter 12 — Team Workflows and Governance**,
where we define collaboration practices: code reviews, branching, PR discipline, release automation, and module publishing policies.
