---
id: function-behavior-and-composition
title: Function Behavior and Composition
sidebar_position: 4
description: Design composable, pipeline-safe, and modular functions that follow PowerShell idioms.
---

> “Consistency is what turns code into a system.”

This chapter focuses on how PowerShell functions behave — individually and together.
You will learn how to design functions that are **predictable**, **composable**, and **pipeline-safe**.

---

## 4.1 Why Behavior Matters

Function design is more than getting the right output — it’s about producing consistent, testable behavior.
In PowerShell, that means every function should:

- Clearly express **what** it does and **what** it returns.
- Behave predictably when used in a **pipeline**.
- Avoid surprising side effects such as console output or hidden global variables.

Poorly behaved functions make automation brittle; well-behaved ones form reusable building blocks.

---

## 4.2 Function Behavior Types

Each function belongs to one behavioral category.
This classification drives naming, contracts, and test strategy.

| Behavior Type | Purpose | Verb Examples | Typical Return |
|----------------|----------|----------------|----------------|
| **Query** | Retrieve data | `Get-`, `Find-`, `Resolve-` | Objects |
| **Transform** | Convert or filter data | `ConvertTo-`, `Select-`, `Group-` | Objects |
| **Predicate** | Evaluate a condition | `Test-` | `[bool]` |
| **Presenter** | Output or format for display | `Write-`, `Format-` | None |
| **Mutator** | Create, modify, or delete state | `New-`, `Set-`, `Remove-` | Confirmation / new state object |

Each behavior type has rules:

- **Queries** and **Transforms** are *pure* (no side effects).
- **Mutators** support `-WhatIf` and `-Confirm`.
- **Predicates** return `$true`/`$false` only.
- **Presenters** use `Write-Output` or `Write-Host` only when formatting; they do not return structured data.

---

## 4.3 Query Functions (Read-Only)

Query functions retrieve data and return objects. They are **pure**: they do not modify state.

### Example

```powershell
function Get-Server {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory, ValueFromPipeline)]
        [string]$Name
    )

    process {
        # Example: simulate retrieval
        [PSCustomObject]@{
            Name      = $Name
            IsOnline  = $true
            PSTypeName = 'Demo.ServerRecord.v1'
        }
    }
}
```

### Design Rules
| Rule | Reason |
|------|--------|
| No side effects | Keeps queries predictable |
| Return typed objects | Enables easy filtering and pipeline composition |
| Support `ValueFromPipeline` | Allows streaming large data sets |
| Avoid formatting text | Leave display to presenters |

---

## 4.4 Transform Functions

Transform functions take input, reshape it, and return new objects.
They are *pure* data transformations — no network, no file I/O.

### Example

```powershell
function ConvertTo-ServerSummary {
    [CmdletBinding()]
    param([Parameter(ValueFromPipeline)][object]$InputObject)

    process {
        [PSCustomObject]@{
            Server = $InputObject.Name
            Online = if ($InputObject.IsOnline) { 'Yes' } else { 'No' }
        }
    }
}
```

### Design Rules
| Rule | Reason |
|------|--------|
| Always return PSCustomObject | Predictable structure |
| Do not write output to host | Keep side effects out |
| Support pipeline input | Enables composition |
| Name starts with `ConvertTo-` or `Select-` | Communicates transformation intent |

---

## 4.5 Predicate Functions

Predicate functions perform checks and return a Boolean.
They answer “Is this true?” questions.

### Example

```powershell
function Test-ServerOnline {
    [CmdletBinding()]
    param([Parameter(ValueFromPipeline)][object]$InputObject)

    process {
        return [bool]$InputObject.IsOnline
    }
}
```

### Design Rules
| Rule | Reason |
|------|--------|
| Return `[bool]` only | Ensures reliable testing in conditionals |
| Name starts with `Test-` | Communicates binary intent |
| Keep logic pure | Enables easy unit testing |

---

## 4.6 Presenter Functions

Presenter functions control **how information is displayed**, not what it means.
They never return structured data to the pipeline.

### Example

```powershell
function Write-ServerSummary {
    [CmdletBinding()]
    param([Parameter(ValueFromPipeline)][object]$InputObject)

    process {
        Write-Host ("{0,-15} {1}" -f $InputObject.Server, $InputObject.Online)
    }
}
```

### Design Rules
| Rule | Reason |
|------|--------|
| No return value | Avoids corrupting pipelines |
| Use `Write-Host` or `Format-*` safely | Presentation only |
| Keep formatting minimal | Separation of display and data |
| Optional `-Show` or `-Verbose` modes | Prevents unexpected console output |

---

## 4.7 Mutator Functions (State-Changing)

Mutators change system state — create, update, or remove something.
They must be *idempotent* (safe to run more than once) and support PowerShell’s confirmation semantics.

### Example

```powershell
function Set-ServerMode {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][ValidateSet('Normal','Maintenance')][string]$Mode
    )

    if ($PSCmdlet.ShouldProcess("Server $Name", "Set mode to $Mode")) {
        Write-Verbose "Setting $Name mode to $Mode"
        # Simulate the change
        [PSCustomObject]@{
            Name  = $Name
            Mode  = $Mode
            PSTypeName = 'Demo.ServerModeChange.v1'
        }
    }
}
```

### Design Rules
| Rule | Reason |
|------|--------|
| Implement `SupportsShouldProcess` | Enables `-WhatIf` / `-Confirm` |
| Idempotent actions | Safe re-execution |
| Return structured output | Allows automation and testing |
| Avoid mixed output streams | Predictable behavior |

---

## 4.8 Function Composition (Pipelines)

Composition means chaining simple functions so each one does a small piece of work.

### Example Workflow

```powershell
Get-Server -Name "Web01","Web02" |
ConvertTo-ServerSummary |
Write-ServerSummary
```

**Execution flow:**
1. `Get-Server` queries raw data.
2. `ConvertTo-ServerSummary` reshapes it.
3. `Write-ServerSummary` presents it.

Each function has a clear contract:
- One input, one output type.
- Works in a pipeline.
- Can be tested independently.

---

## 4.9 Streaming with `begin`, `process`, `end`

Use PowerShell’s advanced function blocks to manage performance and memory.

### Example Pattern

```powershell
function Get-ItemInfo {
    [CmdletBinding()]
    param([Parameter(ValueFromPipeline)][string]$Path)

    begin   { $all = @() }
    process {
        $info = Get-Item -Path $Path
        $all += [PSCustomObject]@{ Name=$info.Name; Size=$info.Length }
    }
    end     { $all }
}
```

For large inputs, process items one at a time:

```powershell
function Get-ItemInfoStream {
    [CmdletBinding()]
    param([Parameter(ValueFromPipeline)][string]$Path)

    process {
        $info = Get-Item -Path $Path
        [PSCustomObject]@{ Name=$info.Name; Size=$info.Length }
    }
}
```

Choose `begin/process/end` based on whether aggregation or streaming fits your need.

---

## 4.10 Handling Output Correctly

PowerShell outputs every expression result unless suppressed.
To keep consistency:

| Practice | Example |
|-----------|----------|
| Explicitly `return` objects | `return [PSCustomObject]@{...}` |
| Use `Write-Output` for streaming | `Write-Output $record` |
| Avoid `Write-Host` in non-presenters | Console output breaks pipelines |
| No mixed text/object output | Return only one type per function |

---

## 4.11 Consistency and Contracts

Each public function forms part of your module’s **contract**.

| Contract Type | Example |
|----------------|----------|
| **Parameter contract** | `Find-VM` always accepts `-Names` |
| **Output contract** | `ConvertTo-VMRecord` always returns Name, Status |
| **Error contract** | Exceptions contain `$_.Exception.Message` |
| **Behavioral contract** | `Get-*` never modifies state |

Breaking any of these requires a **major version bump** in your module.

---

## 4.12 Testing Behavior

You can validate behavior with simple Pester tests.

### Example Pester Test

```powershell
Describe "Get-Server" {
    It "Returns objects with Name and IsOnline" {
        $result = Get-Server -Name 'Demo1'
        $result | Should -BeOfType 'System.Management.Automation.PSCustomObject'
        $result.Name | Should -Be 'Demo1'
        $result.IsOnline | Should -Be $true
    }
}
```

Testing ensures your function contracts remain intact as the module evolves.

---

## 4.13 Review Checklist

| Question | Expectation |
|-----------|-------------|
| Does the function fit one behavior type? | Yes |
| Does it follow the verb-noun convention? | Yes |
| Are side effects controlled? | Only in mutators/adapters |
| Does it support the pipeline where appropriate? | Yes |
| Is output structured and typed? | Yes |
| Are `-WhatIf`/`-Confirm` implemented for mutators? | Yes |
| Are tests aligned with contracts? | Yes |

---

## 4.14 Summary

| Concept | Key Rule |
|----------|-----------|
| Query | Read-only; return data |
| Transform | Pure input/output conversion |
| Predicate | Boolean return only |
| Presenter | Display only, no output |
| Mutator | Changes state, supports `ShouldProcess` |
| Pipeline Composition | Each function does one job well |
| Output Contracts | Structured, predictable objects |

---

## Next Chapter

Continue to **Chapter 05 — Pipeline and Performance**
to learn how to optimize execution flow, handle large data sets, and design efficient parallel operations while maintaining architectural discipline.
