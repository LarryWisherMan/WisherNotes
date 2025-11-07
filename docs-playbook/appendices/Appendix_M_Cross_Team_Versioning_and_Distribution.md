---
id: appendix-m
title: Appendix M – Cross-Team Versioning and Distribution
sidebar_position: 13
description: Internal package publishing, dependency graphing, and private gallery distribution.
---


> “A shared module is not just code — it’s a contract between teams.”

This appendix explains how to **version**, **publish**, and **distribute** PowerShell modules safely across teams while avoiding “dependency hell.”
It builds on prior chapters about contracts, idempotency, and composability, focusing on how multiple developers and teams can share and evolve modules together.

---

## M.1 The Problem of Shared Code

When automation expands across teams, common challenges emerge:

| Problem | Example | Result |
|----------|----------|--------|
| Breaking changes | A function renames a property | Downstream scripts fail |
| Version drift | Different environments use different module builds | Inconsistent results |
| Manual distribution | Teams copy folders or zip files | No visibility or governance |
| Untracked dependencies | Scripts assume imported modules | Fragile and error-prone |

The solution: **semantic versioning, structured distribution, and dependency discipline.**

---

## M.2 Semantic Versioning (SemVer)

Semantic versioning defines a simple, universal rule for module evolution:

```
MAJOR.MINOR.PATCH
```

| Part | Meaning | Example |
|------|----------|---------|
| **MAJOR** | Breaking changes | 2.0.0 (renamed a function, removed a field) |
| **MINOR** | Backward-compatible additions | 1.2.0 (added a new command or parameter) |
| **PATCH** | Backward-compatible fixes | 1.2.1 (bug fix or doc update) |

### Versioning Rules
1. Never break consumers in a MINOR or PATCH update.
2. Additive changes (new fields, parameters) are always safe.
3. Deprecate before removing — provide warnings.
4. Maintain internal changelogs (`CHANGELOG.md` or release notes).

---

## M.3 Module Contract Versions

Each **module** defines its external contract via:

- Exported public functions
- Input and output object shapes
- Configuration expectations (psd1)
- Behavior under `-WhatIf`, `-ErrorAction`, etc.

Tag output objects with **typed PSTypeNames** to version them explicitly:

```powershell
[PSCustomObject]@{
    Name = 'Server01'
    Status = 'Online'
    PSTypeName = 'PE.Server.Record.v1'
}
```

> Consumers can check version via:
> `$object.PSTypeNames -contains 'PE.Server.Record.v1'`

---

## M.4 Versioning Strategy for Multi-Team Modules

| Scope | Example | Version Ownership | Notes |
|--------|----------|------------------|-------|
| Core Utilities | PE.Core | Central Team | Stable, high reuse |
| Domain Modules | PE.Compute.Core | Platform Team | Evolve via MINOR updates |
| Provider Adapters | PE.Compute.Providers | Platform Team | Independent release cycles |
| Context/UX Modules | PE.Compute.Discovery, PE.Server | Team-Specific | Frequent updates, low risk |

**Guideline:**
Keep Core modules stable and versioned conservatively; allow Context modules to evolve more rapidly.

---

## M.5 Publishing and Distribution Options

### Option 1 — Private PowerShell Gallery

The most reliable way to share modules between teams.

1. Set up an internal NuGet feed (e.g., Azure Artifacts, ProGet, MyGet, or internal IIS feed).
2. Register the source:

```powershell
Register-PSRepository -Name "PEGallery" -SourceLocation "https://artifacts.local/psgallery"
```

3. Publish:

```powershell
Publish-Module -Path .\output\PE.Compute.Common -Repository PEGallery -NuGetApiKey $env:NUGET_KEY
```

4. Consume:

```powershell
Install-Module -Name PE.Compute.Common -Repository PEGallery -RequiredVersion 1.3.0
```

---

### Option 2 — Git-Based Distribution

When no private gallery is available, teams can version via branches or tags.

Example:
```
git tag v1.2.0
git push origin v1.2.0
```

Consumers clone or import directly:

```powershell
Import-Module "$PSScriptRoot\modules\PE.Compute.Common\PE.Compute.Common.psd1"
```

> Prefer Git tags for version tracking; never rely on “latest main.”

---

## M.6 Dependency Declaration

Every module declares its dependencies in its `.psd1` manifest:

```powershell
@{
    RootModule = 'PE.Compute.Core.psm1'
    ModuleVersion = '1.0.0'
    RequiredModules = @(
        @{ ModuleName = 'PE.Core'; RequiredVersion = '1.1.0' },
        @{ ModuleName = 'PE.Compute.Providers'; ModuleVersion = '1.0.0' }
    )
}
```

**Rules:**
- Always pin minimum compatible versions.
- Avoid `Import-Module` with unqualified names — rely on manifest resolution.
- Test builds against locked dependency versions before release.

---

## M.7 Coordinating Cross-Team Changes

When multiple teams maintain modules, define a change protocol.

| Stage | Action | Owner |
|--------|---------|--------|
| Proposal | Document intent and breaking risks | Author |
| Review | Validate impact and test coverage | Core team |
| Approval | Merge after review | Maintainer |
| Release | Update SemVer and changelog | Releaser |
| Notify | Share in internal changelog or Teams channel | Communication owner |

---

## M.8 Multi-Module Build Pipelines

### Example Workflow (Sampler + ModuleBuilder)

```plaintext
src/
 ├── PE.Core/
 ├── PE.Compute.Core/
 ├── PE.Compute.Providers/
 ├── PE.Compute.Discovery/
 └── PE.Server/
```

Each folder builds independently with versioned output:

```powershell
Invoke-Build Build_ModuleOutput_ModuleBuilder -BuildConfig .\build.psd1
```

All outputs published to the same internal gallery with independent versioning.

---

## M.9 Cross-Team Compatibility Testing

Teams should maintain *contract tests* verifying that dependent modules still behave correctly.

Example Pester Test:

```powershell
Describe 'PE.Compute.Core Compatibility' {
    It 'returns VMRecord with expected fields' {
        $result = ConvertTo-VMRecord -InputObject @{ name='vm1'; power_state='on' }
        $result.PSTypeNames | Should -Contain 'PE.Compute.VMRecord.v1'
        $result | Should -HaveProperty 'Name'
        $result | Should -HaveProperty 'Status'
    }
}
```

Run these tests automatically whenever an upstream module updates.

---

## M.10 Version Compatibility Table (Example)

| Provider Module | Depends On | Min Version | Max Tested |
|------------------|-------------|--------------|-------------|
| PE.Compute.Providers | PE.Core | 1.0.0 | 1.3.0 |
| PE.Compute.Core | PE.Core | 1.1.0 | 1.3.0 |
| PE.Compute.Discovery | PE.Compute.Core | 1.0.0 | 1.2.0 |
| PE.Server | PE.Compute.Discovery | 1.0.0 | 1.1.0 |

Keep this table in your team wiki or build documentation.

---

## M.11 Communication and Documentation

Versioning only works if teams communicate.

Best practices:
- Maintain a `CHANGELOG.md` per module.
- Include release notes in module metadata.
- Share announcements in chat or internal wiki.
- Archive deprecated functions but mark them `[Obsolete()]`.

Example:
```powershell
[Obsolete("Use Get-VM instead.")]
function Get-ComputeVm { ... }
```

---

## M.12 Summary

| Concept | Takeaway |
|----------|-----------|
| SemVer | Version modules predictably |
| Contracts | Preserve public function interfaces |
| Distribution | Use private PSGallery or Git tags |
| Dependencies | Pin and document versions |
| Testing | Verify compatibility between modules |
| Communication | Share changes and deprecations clearly |

> Versioning is a social contract as much as a technical one.
> When done right, it enables trust, reusability, and long-term evolution.

---

**End of Appendix M**
