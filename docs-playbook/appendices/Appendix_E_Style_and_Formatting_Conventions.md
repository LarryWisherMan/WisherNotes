---
id: appendix-e
title: Appendix E – Style and Formatting Conventions
sidebar_position: 5
description: Formatting, naming, and documentation standards.
---

> “Code is read more often than it is written — style is not decoration, it is communication.”

This appendix defines **style**, **layout**, and **documentation** standards for PowerShell modules.
These conventions ensure that every function, from private helper to public cmdlet, is readable, predictable, and consistent across the entire repository.

---

## E.1 Purpose

PowerShell’s flexibility allows many ways to write the same logic.
Engineering discipline requires **one consistent style**, so every contributor can read, review, and extend code confidently.

| Goal                | Description                                      |
| ------------------- | ------------------------------------------------ |
| **Consistency**     | Predictable structure and naming.                |
| **Clarity**         | Readable at a glance; minimal cognitive load.    |
| **Maintainability** | Easy to diff, review, and merge.                 |
| **Compliance**      | Aligns with Microsoft’s cmdlet design standards. |

---

## E.2 Indentation and Layout

### General Rules

| Element                    | Rule                                                  |
| -------------------------- | ----------------------------------------------------- |
| **Indentation**            | 4 spaces (no tabs).                                   |
| **Line length**            | 100 characters max.                                   |
| **Braces**                 | Opening brace on same line as statement.              |
| **Blank lines**            | One blank line between functions or logical sections. |
| **Statement continuation** | Use backtick (`` ` ``) only when unavoidable.         |

### Example

```powershell
function Get-Example {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Name,
        [switch]$VerboseMode
    )

    if ($VerboseMode.IsPresent) {
        Write-Verbose "Getting data for $Name"
    }

    $result = @{ Name = $Name; Time = (Get-Date) }
    [PSCustomObject]$result
}
```

---

## E.3 Function Declaration Standards

| Element             | Rule                                           | Example                        |
| ------------------- | ---------------------------------------------- | ------------------------------ |
| `[CmdletBinding()]` | Always required for public functions.          | `[CmdletBinding()]`            |
| `param()` block     | One parameter per line.                        | `[Parameter()] [string]$Name`  |
| `begin/process/end` | Use when supporting pipelines.                 | See section E.8.               |
| Private helpers     | Still use `[CmdletBinding()]` for consistency. | Internal `Invoke-*` functions. |

---

## E.4 Naming Conventions

### Modules

`PE.<Capability>.<Context>` — e.g., `PE.Compute.Common`, `PE.Compute.Providers`

### Functions

`Verb-Noun` with singular, descriptive nouns.

| Verb Type | Examples                     | Behavior                          |
| --------- | ---------------------------- | --------------------------------- |
| Query     | `Get-`, `Find-`, `Resolve-`  | Return objects, no state change   |
| Transform | `ConvertTo-`, `Select-`      | Pure functions                    |
| Predicate | `Test-`, `Compare-`          | Return `[bool]`                   |
| Mutator   | `New-`, `Set-`, `Remove-`    | Change state, use `ShouldProcess` |
| Presenter | `Write-`, `Show-`, `Format-` | Output only                       |
| Utility   | `Invoke-`, `Measure-`        | Execute or orchestrate logic      |

**Bad**

```
Do-VMThing
RunTask
ProcessData
```

**Good**

```
Find-VM
ConvertTo-VMRecord
Test-ClusterHealth
```

---

## E.5 Comment-Based Help Template

Every public function **must include** comment-based help with these sections:

```powershell
<#
.SYNOPSIS
Short, imperative sentence (~80 chars).

.DESCRIPTION
One paragraph describing purpose, intent, and expected behavior.

.PARAMETER Name
Explain what this parameter represents and how it’s used.

.INPUTS
Types accepted from the pipeline, or “None”.

.OUTPUTS
Return type(s) or object format.

.EXAMPLE
Find-Server -Name "app01"

.EXAMPLE
Find-Server -Name "sql" -StartsWith

.LINK
https://internalwiki/powershell/Find-Server
#>
```

**Guidelines**

- Begin with a **verb phrase** (“Finds …”, “Creates …”, “Tests …”).
- Include at least two examples per public function.
- Keep `.SYNOPSIS` to a single line.
- Link to relevant internal documentation or specs.

---

## E.6 Parameter Formatting and Validation

| Rule                                       | Example                                |
| ------------------------------------------ | -------------------------------------- |
| `[Parameter()]` per line                   | `[Parameter(Mandatory)][string]$Name`  |
| Use `[ValidateSet()]` for known values     | `[ValidateSet('Start','Stop')]$Action` |
| `[switch]` for Boolean intent              | `[switch]$Force`                       |
| Use `[Alias()]` for backward compatibility | `[Alias('VMName')]$Name`               |
| Avoid dynamic parameters unless essential  | Increases complexity unnecessarily.    |

---

## E.7 Output Standards

| Principle                     | Rule                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------- |
| **Return objects, not text.** | Use `[PSCustomObject]`, not `Write-Host`.                                       |
| **Include PSTypeName**        | For contract versioning (`MyModule.Record.v1`).                                 |
| **Consistent property order** | Improves usability and diffs.                                                   |
| **No mixed streams**          | Return only objects on output stream; send diagnostics to `Verbose` or `Error`. |

Example:

```powershell
[PSCustomObject]@{
    PSTypeName  = 'PE.Compute.VMRecord.v1'
    Name        = $Name
    Status      = $Status
    ClusterName = $Cluster
}
```

---

## E.8 Pipeline Support and Flow

When your function supports pipelines:

```powershell
function Find-Server {
    [CmdletBinding()]
    param([Parameter(ValueFromPipeline)][string[]]$Name)

    begin   { $buffer = @() }
    process { $buffer += $Name }
    end     { $buffer | ForEach-Object { Get-Server -Name $_ } }
}
```

**Guidelines**

- Always declare `ValueFromPipeline` where applicable.
- Keep pipeline functions stateless between calls.
- Avoid writing host output inside `process`.
- Return objects only in `end` for predictable results.

---

## E.9 File and Folder Organization

```
PE.Compute.Common/
  data/
    Provider.Nutanix.psd1
  Public/
    Find-VM.ps1
  Private/
    Core/
      Invoke-Retry.ps1
    Domain/
      ConvertTo-VMRecord.ps1
    Adapter/
      Invoke-NtxRequest.ps1
    Context/
      Find-VM.ps1
```

| Folder       | Purpose                               |
| ------------ | ------------------------------------- |
| **data/**    | Static configuration (.psd1).         |
| **Public/**  | Exported cmdlets (user-facing).       |
| **Private/** | Internal helpers, organized by layer. |

---

## E.10 Logging and Diagnostics

| Rule                                 | Tool                                                 | Example                                    |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------------------ |
| Use structured messages              | `Write-Verbose`, `Write-Debug`, `Write-Error`        | `Write-Verbose "Connecting to $ServerUri"` |
| Do not use `Write-Host`              | Avoids breaking pipelines and automation.            | ❌                                         |
| Wrap error context                   | `throw "Failed to connect: $($_.Exception.Message)"` | ✅                                         |
| Use `try/catch/finally` consistently | Catch only expected exceptions.                      |                                            |

---

## E.11 Comment and Documentation Standards

| Type               | Purpose                          | Example                                          |
| ------------------ | -------------------------------- | ------------------------------------------------ |
| **Header comment** | File-level summary               | `# Region: Domain / ConvertTo-VMRecord`          |
| **Inline comment** | Explain reasoning, not mechanics | `# Retry logic handles transient network issues` |
| **Docstring**      | Summarize function behavior      | See Section E.5                                  |

Bad:

```powershell
# Add one
$x = $x + 1
```

Good:

```powershell
# Increment retry counter for transient API failures
$x++
```

---

## E.12 Code Review Checklist

| Category       | Criteria                                |
| -------------- | --------------------------------------- |
| **Formatting** | Indentation and braces follow standard. |
| **Naming**     | Verb–Noun with clear domain noun.       |
| **Parameters** | Validated, typed, and consistent.       |
| **Output**     | Structured, typed, no mixed streams.    |
| **Help**       | Present and complete with examples.     |
| **Logging**    | Uses `Write-Verbose`, not `Write-Host`. |
| **Contracts**  | Outputs include versioned PSTypeName.   |

---

## E.13 Style Examples: Before and After

### Before (inconsistent)

```powershell
function runjob($n){
write-host "running job $n"
Invoke-RestMethod "https://api/jobs/$n"
}
```

### After (compliant)

```powershell
function Invoke-Job {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Name
    )

    Write-Verbose "Invoking job $Name"
    $response = Invoke-RestMethod -Uri "https://api/jobs/$Name"
    [PSCustomObject]@{
        PSTypeName = 'PE.Job.Result.v1'
        Name       = $Name
        Status     = $response.status
    }
}
```

**Improvements**

- `[CmdletBinding()]` and parameter typing.
- Verb–Noun naming.
- Verbose logging instead of host output.
- Typed output object.
- Reusable and testable structure.

---

## E.14 Summary

| Principle     | Practice                                        |
| ------------- | ----------------------------------------------- |
| Consistency   | Shared indentation, naming, and file structure. |
| Clarity       | Readable functions with clear intent.           |
| Contracts     | Consistent input/output patterns.               |
| Documentation | Every public function has help and examples.    |
| Discipline    | Style guides prevent drift and confusion.       |

Adopting these conventions ensures every script and module produced by your team looks, feels, and behaves consistently — enabling collaboration and long-term maintainability.

---

**End of Playbook**

You have now completed the PowerShell Engineering Playbook and all appendices.
Together, these documents define a **complete lifecycle**: from architectural thinking to module design, testing, configuration, and code style.
