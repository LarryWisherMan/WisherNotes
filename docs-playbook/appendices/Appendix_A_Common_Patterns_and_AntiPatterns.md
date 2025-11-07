---
id: appendix-a
title: Appendix A – Common Patterns and Anti-Patterns
sidebar_position: 1
description: Real-world examples of effective vs. poor PowerShell design.
---

> “Patterns make good behavior repeatable. Anti-patterns make bad behavior permanent.”

This appendix serves as a practical reference for writing clear, maintainable, and testable PowerShell code.
Each section contrasts **effective patterns** with **common pitfalls**, explaining why the former scales and the latter breaks under growth.

---

## A.1 Function Design

### Pattern: One Responsibility per Function
Each function should have *one clear purpose* and *one reason to change*.

**Good**
```powershell
function Get-ClusterStatus {
    [CmdletBinding()]
    param([string]$Cluster)

    $nodes = Get-ClusterNode -Cluster $Cluster
    [PSCustomObject]@{
        Cluster = $Cluster
        NodeCount = $nodes.Count
        Healthy   = ($nodes | Where-Object State -eq 'Up').Count -eq $nodes.Count
    }
}
```

**Bad**
```powershell
function CheckCluster {
    param($Cluster)
    $nodes = Get-ClusterNode -Cluster $Cluster
    if ($nodes.State -contains 'Down') {
        Restart-ClusterNode -Cluster $Cluster
    }
    Write-Host "Cluster $Cluster checked."
}
```

**Why It Matters**
- The “bad” example mixes *query* and *mutation*.
- The “good” example isolates *query logic* — safe for pipelines and testing.

---

## A.2 Layer Separation

### Pattern: Depend Downward Only
Context functions should orchestrate, not implement.

**Good**
```powershell
function Find-VM {
    [CmdletBinding()]
    param([string[]]$Names)

    $results = foreach ($name in $Names) {
        $data = Invoke-ProviderRequest -Uri "https://api/vms?name=$name"
        ConvertTo-VMRecord -InputObject $data
    }
    return $results
}
```

**Bad**
```powershell
function Find-VM {
    param($Names)
    $results = @()
    foreach ($name in $Names) {
        $r = Invoke-RestMethod "https://api/vms?name=$name"
        $results += [PSCustomObject]@{ Name = $r.name; Status = $r.power_state }
    }
    return $results
}
```

**Why It Matters**
- The “bad” version ties directly to REST — no separation between context, domain, and adapter.
- The “good” version calls adapters and domain helpers — clean dependency flow.

---

## A.3 Purity and Side Effects

### Pattern: Functional Core / Imperative Shell
Keep transformation logic separate from side effects.

**Good**
```powershell
function ConvertTo-ServerRecord {
    param([object]$Input)
    [PSCustomObject]@{
        Name = $Input.name
        State = $Input.state.ToUpper()
    }
}

function Get-ServerRecord {
    param([string]$Name)
    $raw = Invoke-RestMethod "https://api/servers/$Name"
    ConvertTo-ServerRecord -Input $raw
}
```

**Bad**
```powershell
function Get-ServerRecord {
    param($Name)
    $raw = Invoke-RestMethod "https://api/servers/$Name"
    [PSCustomObject]@{
        Name = $raw.name
        State = $raw.state.ToUpper()
        Timestamp = (Get-Date)
    } | Export-Csv "C:\temp\servers.csv"
}
```

**Why It Matters**
- Side effects (file I/O) inside logic break testability.
- Keep *pure logic* (data transformation) separate from *impure I/O* (files, APIs, console).

---

## A.4 Parameter and Pipeline Behavior

### Pattern: Pipeline-Friendly Functions
Support streaming input with `begin/process/end` blocks.

**Good**
```powershell
function Get-UserInfo {
    [CmdletBinding()]
    param([Parameter(ValueFromPipeline)][string[]]$UserNames)

    begin { $all = @() }
    process {
        foreach ($name in $UserNames) {
            $all += [PSCustomObject]@{ User = $name; Exists = $true }
        }
    }
    end { $all }
}
```

**Bad**
```powershell
function Get-UserInfo {
    param($UserNames)
    $UserNames | ForEach-Object {
        Write-Host "User: $_"
    }
}
```

**Why It Matters**
- “Bad” example writes directly to host; no object output.
- “Good” example streams objects properly and supports composition.

---

## A.5 Configuration and Extensibility

### Pattern: Configuration over Hard-Coding
Load values from `.psd1` files or environment variables.

**Good**
```powershell
function Get-ProviderUri {
    $config = Import-PowerShellDataFile "data/Provider.Sample.psd1"
    $envOverride = $env:PROVIDER_URI
    return ($envOverride ? $envOverride : $config.DefaultUri)
}
```

**Bad**
```powershell
function Get-ProviderUri {
    return "https://api.production.local"
}
```

**Why It Matters**
- Configuration enables environment switching and testing.
- Hardcoded values make functions brittle and environment-specific.

---

## A.6 Error Handling

### Pattern: Contextual Try/Catch
Handle expected failures close to source and rethrow cleanly.

**Good**
```powershell
function Invoke-ApiRequest {
    [CmdletBinding()]
    param([string]$Uri)
    try {
        Invoke-RestMethod -Uri $Uri -ErrorAction Stop
    }
    catch {
        throw "API request to '$Uri' failed: $($_.Exception.Message)"
    }
}
```

**Bad**
```powershell
function Invoke-ApiRequest {
    param($Uri)
    Invoke-RestMethod $Uri
    Write-Host "Done."
}
```

**Why It Matters**
- Unhandled errors cause cascading failures.
- Contextualized exceptions make troubleshooting fast and consistent.

---

## A.7 Output Consistency

### Pattern: Structured PSCustomObjects
Always return objects with predictable property names.

**Good**
```powershell
function Get-DiskInfo {
    [CmdletBinding()]
    param([string]$ComputerName)
    Get-WmiObject Win32_LogicalDisk -ComputerName $ComputerName |
        Select-Object @{n='ComputerName';e={$ComputerName}}, DeviceID, Size, FreeSpace
}
```

**Bad**
```powershell
function Get-DiskInfo {
    param($ComputerName)
    Get-WmiObject Win32_LogicalDisk -ComputerName $ComputerName |
        Format-Table DeviceID, Size, FreeSpace
}
```

**Why It Matters**
- `Format-*` should never appear in pipeline functions — it breaks downstream processing.
- Return *objects*, not *formatted text*.

---

## A.8 Naming and Verb-Noun Alignment

### Pattern: Approved Verb Usage
Follow PowerShell naming standards to communicate intent.

| Verb | Behavior | Example | Category |
|------|-----------|----------|-----------|
| Get  | Query existing data | `Get-VM` | Query |
| Find | Search/filter | `Find-User` | Query |
| Test | Return boolean | `Test-ClusterConnectivity` | Predicate |
| New  | Create new entity | `New-Session` | Mutator |
| Set  | Modify existing | `Set-ServerMode` | Mutator |
| Remove | Delete entity | `Remove-VM` | Mutator |
| ConvertTo | Transform data | `ConvertTo-VMRecord` | Transform |
| Write | Output/log | `Write-Log` | Presenter |

**Anti-Pattern Examples**
- `Do-Thing` — ambiguous verb.
- `RunCheck` — unclear behavior.
- `ProcessData` — too generic.

---

## A.9 Testing and Contracts

### Pattern: Testable Contracts
Define clear input/output contracts; test behavior, not implementation.

**Good**
```powershell
Describe 'ConvertTo-VMRecord' {
    It 'Normalizes VM object' {
        $input = @{ name='vm01'; power_state='on' }
        $result = ConvertTo-VMRecord -InputObject $input
        $result.Name | Should -Be 'vm01'
        $result.Status | Should -Be 'on'
    }
}
```

**Bad**
```powershell
Describe 'ConvertTo-VMRecord' {
    It 'Calls Write-Host' {
        Mock Write-Host {}
        ConvertTo-VMRecord | Should -Not -Throw
    }
}
```

**Why It Matters**
- Good tests confirm **behavioral contracts**.
- Bad tests only confirm that the function didn’t crash.

---

## A.10 Common Anti-Patterns Summary

| Anti-Pattern | Description | Impact |
|---------------|--------------|--------|
| Mixing read/write behavior | Query and mutate in one function | Unpredictable state |
| Hardcoded values | Inline constants, URLs, or paths | Fragile across environments |
| Write-Host in logic | Sends data to console, breaks pipeline | Non-composable output |
| Format-* in logic | Formats instead of returning objects | Blocks further processing |
| Catch-all try/catch without rethrow | Hides real errors | Debugging complexity |
| Global variables | Implicit dependencies | Breaks encapsulation |
| Multi-purpose parameters | One flag controls many behaviors | Ambiguous contracts |
| Implicit conversions | No `[string]`, `[int]` annotations | Runtime errors |
| Inline REST logic | No adapter isolation | Tight coupling |

---

## A.11 Quick Reference: Checklist

| Category | Guideline | Expectation |
|-----------|------------|-------------|
| **Function** | One responsibility | ✅ |
| **Parameters** | Typed and validated | ✅ |
| **Pipelines** | Support begin/process/end | ✅ |
| **Output** | PSCustomObject, not text | ✅ |
| **Configuration** | Externalized via psd1/env | ✅ |
| **Errors** | Contextual and rethrown | ✅ |
| **Naming** | Approved verbs only | ✅ |
| **Testing** | Contracts validated | ✅ |

---

## A.12 Summary

**Good PowerShell engineering is repeatable because it’s intentional.**
Patterns are reusable agreements between engineers about *how* to write code — and *why* those rules exist.
This appendix is your quick guide to identifying whether your code is:
- Predictable
- Composable
- Testable
- Configurable
- Maintainable

When in doubt, ask:
> “Does this function have one reason to change, one purpose, and one predictable output?”

If yes, you’re following the pattern — not the anti-pattern.

---

**Next Appendix →**
[Appendix B — Verb-Noun Reference and Behavior Matrix](Appendix_B_VerbNoun_Behavior_Matrix.md)
