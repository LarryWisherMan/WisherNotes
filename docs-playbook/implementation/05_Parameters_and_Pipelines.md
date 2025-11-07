---
id: parameters-and-pipelines
title: Parameters and Pipelines
sidebar_position: 5
description: Building predictable interfaces — parameters, input binding, and pipeline consistency.
---

> “Performance isn’t about doing things fast — it’s about doing them right at scale.”

This chapter explores how to design PowerShell functions that perform efficiently in pipelines, handle large inputs gracefully, and stay consistent under load.
You’ll learn practical strategies for streaming data, managing concurrency, and optimizing memory — all while preserving readability and correctness.

---

## 5.1 Why Performance Matters

In PowerShell, performance is not only measured in milliseconds. It’s about:

- **Responsiveness:** The user shouldn’t wait for visible output.
- **Scalability:** Commands should handle hundreds or thousands of items without choking.
- **Composability:** Functions must work efficiently in pipelines, not just as standalone commands.
- **Predictability:** Avoid unpredictable delays caused by blocking or excessive buffering.

Poorly designed scripts often fail here — they load everything into memory, run sequentially, or generate chatty output.

### Common Performance Pitfalls

| Problem | Symptom | Fix |
|----------|----------|----|
| Full memory buffering | Function collects all items before returning | Stream results via `process` block |
| Excessive host output | Too much `Write-Host` | Use `Write-Verbose` or `Write-Progress` |
| Hidden loops | Functions that re-enumerate collections | Convert to pipeline processing |
| Blocking network calls | Sequential API requests | Parallelize using jobs or runspaces |

---

## 5.2 The PowerShell Pipeline Model

The PowerShell pipeline is **pull-based** — each command requests input as needed.

```
Input Objects  →  [process{} block]  →  Output Objects
```

Each function in a chain executes per input object, not all at once.
Understanding this model helps you write commands that:

- Use less memory
- Start producing results sooner
- Compose seamlessly with others

---

## 5.3 The `begin`, `process`, and `end` Blocks

Every advanced function can define these three stages:

| Block | Runs When | Use For |
|--------|------------|--------|
| `begin` | Once, before processing starts | Setup: create arrays, initialize resources |
| `process` | Once per pipeline input | Per-item logic, streaming |
| `end` | Once after all items processed | Finalization, summaries |

### Example

```powershell
function Get-LogSummary {
    [CmdletBinding()]
    param([Parameter(ValueFromPipeline)][string]$Path)

    begin { $totals = @{} }
    process {
        $lines = Get-Content -Path $Path
        $totals[$Path] = $lines.Count
    }
    end {
        foreach ($k in $totals.Keys) {
            [PSCustomObject]@{ File = $k; Lines = $totals[$k] }
        }
    }
}
```

**Streaming:** For large logs, you could replace `Get-Content` with `Get-Content -ReadCount 1000` to reduce memory pressure.

---

## 5.4 Streaming vs. Buffering

| Mode | Description | Pros | Cons |
|------|--------------|------|------|
| **Streaming (`process`)** | Emit objects as they’re processed | Low memory, fast feedback | Harder to summarize totals |
| **Buffering (`end`)** | Collect all then emit at once | Easy summaries | High memory use, delayed results |

Rule of thumb:
- Use streaming when returning lists or search results.
- Use buffering when aggregating or computing totals.

---

## 5.5 Pipeline Input Patterns

### Pattern 1: Item-by-Item Streaming
```powershell
function Get-ServerInfo {
    [CmdletBinding()]
    param([Parameter(ValueFromPipeline)][string]$Name)

    process {
        Get-Server -Name $Name | ConvertTo-ServerSummary
    }
}
```

### Pattern 2: Aggregation After Pipeline
```powershell
function Measure-ServerStatus {
    [CmdletBinding()]
    param([Parameter(ValueFromPipeline)][object]$InputObject)

    begin { $online = 0; $total = 0 }
    process {
        $total++
        if ($InputObject.IsOnline) { $online++ }
    }
    end {
        [PSCustomObject]@{
            Total  = $total
            Online = $online
            Ratio  = [math]::Round(($online / $total) * 100, 2)
        }
    }
}
```

---

## 5.6 Parallelism with Runspaces (Advanced)

PowerShell’s native pipeline is single-threaded.
To handle many independent operations (e.g., querying multiple servers), you can use **runspaces** for concurrency.

### Example: Parallel Processing Template

```powershell
function Invoke-InParallel {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory, ValueFromPipeline)][object[]]$InputObjects,
        [Parameter(Mandatory)][scriptblock]$ScriptBlock,
        [int]$MaxThreads = 5
    )

    begin {
        $pool = [runspacefactory]::CreateRunspacePool(1, $MaxThreads)
        $pool.Open()
        $jobs = @()
    }
    process {
        foreach ($item in $InputObjects) {
            $ps = [powershell]::Create().AddScript($ScriptBlock).AddArgument($item)
            $ps.RunspacePool = $pool
            $jobs += [pscustomobject]@{ Pipe = $ps; Handle = $ps.BeginInvoke() }
        }
    }
    end {
        foreach ($job in $jobs) {
            $result = $job.Pipe.EndInvoke($job.Handle)
            $job.Pipe.Dispose()
            Write-Output $result
        }
        $pool.Close()
        $pool.Dispose()
    }
}
```

You can now process input in parallel:

```powershell
1..10 | Invoke-InParallel -ScriptBlock { param($n) "Task $n complete" } -MaxThreads 4
```

**Warning:** Parallelism introduces complexity — use it only when necessary, and avoid mutating shared state.

---

## 5.7 Avoiding Hidden Performance Traps

| Anti-Pattern | Description | Fix |
|---------------|-------------|-----|
| Implicit output in loops | Uncontrolled object emission | Use `Write-Output` intentionally |
| Mixed object and text output | Breaks downstream functions | Return one type only |
| Nested pipelines inside loops | Creates overhead per iteration | Use streaming or batch calls |
| Overuse of `ForEach-Object` with REST calls | Sequentially slow | Parallelize via jobs or batching |

---

## 5.8 Memory Efficiency and Object Size

Each `[PSCustomObject]` carries type metadata and overhead.
When processing thousands of records:

- Limit unnecessary properties.
- Use `[ordered]@{}` only when order matters.
- Avoid repeatedly expanding JSON unnecessarily.

### Example
Instead of:
```powershell
$json = (Invoke-RestMethod $uri | ConvertTo-Json)
$objects = $json | ConvertFrom-Json
```

Use:
```powershell
$objects = Invoke-RestMethod $uri  # Avoid double serialization
```

---

## 5.9 Error Handling in Pipelines

When processing many items, don’t stop the entire pipeline on one failure.
Use structured error handling instead.

### Example

```powershell
function Get-ServerStatusSafe {
    [CmdletBinding()]
    param([Parameter(ValueFromPipeline)][string]$Server)

    process {
        try {
            $ping = Test-Connection -ComputerName $Server -Count 1 -Quiet -ErrorAction Stop
            [PSCustomObject]@{ Server = $Server; Online = $ping }
        }
        catch {
            Write-Warning "Failed to reach $Server: $($_.Exception.Message)"
        }
    }
}
```

This allows continued processing without breaking the chain.

---

## 5.10 Performance Logging

For long-running operations, provide progress and timing visibility.

```powershell
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
# ... run tasks ...
$stopwatch.Stop()
Write-Verbose ("Completed in {0:N2} seconds" -f $stopwatch.Elapsed.TotalSeconds)
```

### Progress Example
```powershell
foreach ($i in 1..100) {
    Write-Progress -Activity "Processing items" -Status "Item $i" -PercentComplete ($i)
    Start-Sleep -Milliseconds 50
}
```

This keeps users informed without cluttering output.

---

## 5.11 Design for Composition, Not Speed

Good performance in PowerShell is often about **composability**, not micro-optimization.

- A function that can be combined with others efficiently is more valuable than one that’s slightly faster but isolated.
- Avoid “do-everything” monoliths — they can’t scale or be reused.

### Example
Instead of a single function `Find-And-Convert-VMs`, prefer:

```
Find-VM | ConvertTo-VMRecord | Export-Csv results.csv
```

Each stage focuses on one responsibility, leveraging PowerShell’s streaming model for efficiency.

---

## 5.12 Review Checklist

| Question | Expectation |
|-----------|-------------|
| Does the function stream data via `process`? | Yes |
| Are `begin/process/end` blocks used correctly? | Yes |
| Is output consistent and structured? | Yes |
| Are side effects isolated to adapters? | Yes |
| Are loops efficient and memory-safe? | Yes |
| Is `Write-Progress` or timing feedback provided for long runs? | Optional but encouraged |
| Does the design scale gracefully with more input? | Yes |

---

## 5.13 Summary

| Concept | Key Practice |
|----------|---------------|
| Pipeline Model | Process one object at a time |
| Streaming vs Buffering | Stream when possible, buffer for summaries |
| Runspaces | Parallelize independent work safely |
| Composition | Small, reusable commands outperform monoliths |
| Error Handling | Fail gracefully, keep pipelines running |
| User Feedback | Use `Write-Progress` and `Verbose` for clarity |

---

## Next Chapter

Continue to **Chapter 06 — Parameters, Contracts, and Inputs**
to learn how to design stable, predictable input contracts for every layer — from parameter validation to module-level versioning.
