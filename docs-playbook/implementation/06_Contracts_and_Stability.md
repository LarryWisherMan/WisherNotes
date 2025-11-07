---
id: contracts-and-stability
title: Contracts and Stability
sidebar_position: 6
description: Defining, validating, and maintaining backward-compatible function contracts.
---


> “A great function doesn’t surprise its users — it teaches them what to expect.”

This chapter covers how to define, validate, and evolve PowerShell parameters and function contracts so that scripts and modules remain predictable, testable, and backward compatible.

---

## 6.1 Why Parameters and Contracts Matter

PowerShell is a user-facing language — everything begins with parameters.
A well-designed parameter set defines not just *how* a function runs, but also its **behavioral contract** with users and other functions.

Poorly designed parameters lead to:
- Confusing errors
- Broken pipelines
- Inconsistent naming
- Unintended breaking changes

Good parameter design communicates purpose clearly and enforces consistency automatically.

---

## 6.2 Understanding Contracts

Every function has four levels of contract:

| Contract Type | Description | Example |
|----------------|--------------|----------|
| **Parameter Contract** | Input types, names, and validation rules | `Find-VM -Names` always accepts `[string[]]` |
| **Output Contract** | What type/shape the function returns | `ConvertTo-VMRecord` always returns Name, Status |
| **Error Contract** | How exceptions or warnings are surfaced | `Invoke-NtxRequest` throws for HTTP 500, warns for 404 |
| **Behavioral Contract** | What the function promises to do (and not do) | `Get-*` never modifies state |

Contracts form the backbone of module reliability — breaking them without a major version bump causes downstream errors.

---

## 6.3 Designing Clear Parameters

Parameters should make a function self-explanatory.

### Example: Poor vs. Good Parameter Design

**Poor Design**
```powershell
function Get-Data {
    param($x, $y, $z)
}
```

**Improved Design**
```powershell
function Find-Server {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory, ValueFromPipeline, ValueFromPipelineByPropertyName)]
        [Alias('Name')]
        [string[]]$ServerName,

        [switch]$OnlineOnly,
        [int]$TimeoutSec = 30
    )
}
```

### Good Design Traits
| Rule | Description |
|------|--------------|
| Self-descriptive names | Each parameter conveys intent |
| Type enforcement | `[string]`, `[int]`, `[switch]`, `[PSCredential]` |
| Default values for common options | Avoids mandatory overload |
| Consistent naming across layers | “ServerName” means the same everywhere |
| Optional switches | Provide discoverable modifiers without breaking compatibility |

---

## 6.4 Validation and Enforcement

PowerShell offers built-in validation attributes to keep inputs safe and predictable.

### Example

```powershell
param(
    [Parameter(Mandatory)]
    [ValidateNotNullOrEmpty()]
    [ValidateLength(1,50)]
    [string]$Name,

    [ValidateSet('Started','Stopped','Suspended')]
    [string]$State
)
```

**Common Validation Attributes**

| Attribute | Purpose |
|------------|----------|
| `[ValidateSet()]` | Restrict to known values |
| `[ValidateRange()]` | Numeric boundaries |
| `[ValidatePattern()]` | Regex-based input validation |
| `[ValidateScript()]` | Custom logic |
| `[ValidateNotNullOrEmpty()]` | Prevents empty/null input |

Validation acts as *guardrails* for your contracts — catching problems before they hit runtime.

---

## 6.5 Parameter Sets

When a function can behave in different modes, use **parameter sets** to prevent confusion.

### Example

```powershell
function Get-Report {
    [CmdletBinding(DefaultParameterSetName='ByName')]
    param(
        [Parameter(ParameterSetName='ByName', Mandatory)]
        [string]$Name,

        [Parameter(ParameterSetName='ById', Mandatory)]
        [int]$Id
    )

    switch ($PSCmdlet.ParameterSetName) {
        'ByName' { "Report by name: $Name" }
        'ById'   { "Report by ID: $Id" }
    }
}
```

### Guidelines
- Each set should describe **one mode of operation**.
- Use `DefaultParameterSetName` for clarity.
- Never mix mutually exclusive parameters in the same set.

This improves discoverability and prevents users from calling incompatible arguments together.

---

## 6.6 Using Switch Parameters Correctly

Switch parameters are `[bool]` flags that are either present or absent.
They must be checked using `.IsPresent` in PowerShell 5.1.

### Example

```powershell
if ($OnlineOnly.IsPresent) {
    Write-Verbose "Filtering to online servers only"
}
```

**Guidelines**

| Rule | Reason |
|------|--------|
| Always use `.IsPresent` | Safe for PowerShell 5.1 |
| Default is `$false` | Predictable behavior |
| Don’t overload switches | One clear purpose per switch |

---

## 6.7 Pipeline Input and Parameter Binding

### Why It Matters
Pipeline binding allows your function to act like part of a larger system rather than a closed box.

### Example

```powershell
function Get-ServerStatus {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory, ValueFromPipeline, ValueFromPipelineByPropertyName)]
        [string]$ServerName
    )

    process {
        [PSCustomObject]@{
            Name     = $ServerName
            IsOnline = (Test-Connection $ServerName -Count 1 -Quiet)
        }
    }
}
```

### Binding Rules
| Mode | Description |
|------|--------------|
| `ValueFromPipeline` | Accepts direct object input |
| `ValueFromPipelineByPropertyName` | Matches input property names |
| Combine both | Enables flexible composition |

This allows seamless chaining like:
```powershell
'Server1','Server2' | Get-ServerStatus
```

---

## 6.8 Forwarding Parameters

To keep functions composable, forward parameters safely using `PSBoundParameters`.

### Example

```powershell
function Invoke-WithTimeout {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][scriptblock]$Script,
        [int]$TimeoutSec = 60
    )

    & $Script @PSBoundParameters
}
```

You can selectively forward options to helper functions:
```powershell
$forward = @{}
if ($PSBoundParameters.ContainsKey('TimeoutSec')) { $forward.TimeoutSec = $TimeoutSec }
Invoke-Retry @forward -Action { ... }
```

---

## 6.9 Designing Extensible Contracts

As your modules evolve, users will depend on existing contracts.
Follow these rules to remain backward-compatible.

| Action | Impact | Recommendation |
|---------|--------|----------------|
| Remove parameter | Breaking | Avoid |
| Rename parameter | Breaking | Use `[Alias()]` instead |
| Change parameter type | Breaking | Create a new parameter |
| Add new optional parameter | Safe | OK |
| Add new output property | Safe | OK |
| Change output property meaning | Breaking | Avoid |
| Change return type | Breaking | Avoid |

### Example: Safe Evolution

```powershell
param(
    [Parameter(Mandatory)][string]$Name,
    [Alias('Timeout')][int]$TimeoutSec = 60  # Non-breaking alias
)
```

---

## 6.10 Defining Output Contracts

Every function should explicitly control its output — shape, type, and meaning.

### Example

```powershell
[PSCustomObject]@{
    Name   = $ServerName
    Status = 'Online'
    PSTypeName = 'PE.ServerRecord.v1'
}
```

**Guidelines**

| Rule | Reason |
|------|--------|
| Always return `PSCustomObject` | Structured, pipeline-friendly |
| Add `PSTypeName` | Enables type-based formatting and testing |
| Never mix strings and objects | Predictable output type |
| Don’t rely on implicit output | Use `return` or `Write-Output` intentionally |

---

## 6.11 Error Contracts

Errors are part of the user interface.
A consistent error contract makes debugging predictable.

### Example

```powershell
try {
    Invoke-RestMethod -Uri $Uri -ErrorAction Stop
}
catch {
    Write-Error -Message "Request failed: $($_.Exception.Message)" -Category InvalidOperation
}
```

**Best Practices**
- Use `throw` for fatal, unrecoverable conditions.
- Use `Write-Error` for recoverable issues.
- Include contextual details (never secrets).
- Avoid plain text `Write-Host` errors.

---

## 6.12 Behavioral Contracts per Layer

| Layer | Primary Contract | Example |
|--------|------------------|----------|
| **Core** | Input/output types | `Invoke-Retry` always returns the last result |
| **Domain** | Object shape & validation | `ConvertTo-Record` outputs consistent fields |
| **Adapter** | API surface behavior | `Invoke-ApiRequest` returns normalized responses |
| **Context** | User interaction & parameter contract | `Find-VM` always accepts `-Names` and outputs standardized records |

The higher the layer, the broader the audience — therefore, the stricter the contract enforcement.

---

## 6.13 Testing Contracts

Use **Pester** to enforce parameter and output consistency.

### Example: Parameter Contract Test

```powershell
Describe "Find-VM Parameter Contract" {
    It "Exposes -Names and -StartsWith switches" {
        $params = (Get-Command Find-VM).Parameters.Keys
        $params | Should -Contain 'Names'
        $params | Should -Contain 'StartsWith'
    }
}
```

### Example: Output Contract Test

```powershell
Describe "Find-VM Output Contract" {
    It "Returns VMRecord objects" {
        $result = Find-VM -Names 'Test'
        $result.PSTypeNames | Should -Contain 'PE.Compute.VMRecord.v1'
    }
}
```

---

## 6.14 Review Checklist

| Question | Expectation |
|-----------|-------------|
| Do parameters have clear names and types? | Yes |
| Are `[CmdletBinding()]` and validation attributes used? | Yes |
| Are pipelines supported correctly? | Yes |
| Are optional parameters defaulted sensibly? | Yes |
| Are aliases used for backward compatibility? | Yes |
| Are structured output and PSTypeName enforced? | Yes |
| Is error handling consistent? | Yes |
| Are contracts covered by tests? | Yes |

---

## 6.15 Summary

| Concept | Rule |
|----------|------|
| Parameter design | Communicate intent through names and validation |
| Pipeline binding | Enable streaming and composition |
| Forwarding | Use `PSBoundParameters` for extensibility |
| Output contract | Always return structured, typed objects |
| Error contract | Predictable and contextual errors |
| Stability | Avoid breaking changes; evolve safely |
| Testing | Enforce contracts with Pester |

---

## Next Chapter

Continue to **Chapter 07 — Error Handling and Resilience**
to learn how to manage exceptions, retries, logging, and recovery patterns that make PowerShell modules fault-tolerant in production environments.
