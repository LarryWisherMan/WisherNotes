---
id: testing-and-quality-discipline
title: Testing and Quality Discipline
sidebar_position: 9
description: Using Pester for unit, integration, and contract testing aligned to layers.
---

> “Testing is not about finding bugs — it’s about proving your design works under stress.”

This chapter establishes the testing strategy for engineered PowerShell modules.
It explains **what to test**, **where to test**, and **how** to do so using **Pester 5**, following your clean architecture layers: Core, Domain, Adapter, and Context.

---

## 9.1 Why Testing Matters in Engineering PowerShell

Scripts fail silently when one assumption changes.
Engineered modules, by contrast, survive change — because their contracts are verified.

Testing enforces:
- **Confidence** — modules behave the same after refactors.
- **Contracts** — functions return predictable structures.
- **Safety** — breaking changes are caught early.
- **Documentation** — tests communicate intent and behavior.

Without tests, every edit is a gamble.
With them, change becomes low-risk and iterative.

---

## 9.2 The PowerShell Testing Landscape

PowerShell uses **Pester**, a native testing framework that supports:
- Unit, integration, and acceptance testing
- Mocking of cmdlets and REST calls
- Code coverage metrics
- CI/CD integration (Azure DevOps, GitHub Actions, Jenkins)

Your test folders should mirror module structure:

```
tests/
  Unit/
    Core/
    Domain/
  Integration/
    Adapter/
  QA/
    Context/
```

---

## 9.3 Test Strategy by Layer

| Layer | Type of Test | Scope | Example |
|--------|--------------|--------|----------|
| **Core** | Unit | Pure functions | `New-ComputeUri`, `Invoke-Retry` |
| **Domain** | Unit | Transformations and validation | `ConvertTo-VMRecord`, `Test-VMIsRunning` |
| **Adapter** | Integration | REST, CLI, or SDK interaction | `Invoke-NtxRequest`, `Connect-AzSession` |
| **Context** | Contract / QA | Public workflows | `Find-VM`, `Sync-ClusterInventory` |

Each layer’s test serves a different purpose — but together they ensure the entire system behaves predictably.

---

## 9.4 Unit Testing (Core and Domain Layers)

Unit tests validate pure functions — logic with no side effects or dependencies.

### Example: Core Utility Test

**Function Under Test**
```powershell
function Invoke-Retry {
    param([scriptblock]$Action, [int]$Attempts = 3)
    for ($i = 1; $i -le $Attempts; $i++) {
        try { return & $Action }
        catch { if ($i -eq $Attempts) { throw } }
    }
}
```

**Test File**
```powershell
Describe "Invoke-Retry" {
    It "Retries the action until success" {
        $count = 0
        $result = Invoke-Retry -Action {
            $script:count++
            if ($count -lt 2) { throw "fail" } else { "success" }
        }
        $result | Should -Be "success"
        $count  | Should -Be 2
    }
}
```

**Principle:**
Test deterministic logic in isolation.
No external resources, no mocks needed.

---

## 9.5 Domain Testing: Validating Transformations

Domain functions shape or validate data.
Tests should confirm that transformation contracts remain stable.

### Example

**Function**
```powershell
function ConvertTo-VMRecord {
    [CmdletBinding()]
    param([object]$InputObject)
    [PSCustomObject]@{
        Name   = $InputObject.name
        Status = $InputObject.power_state
    }
}
```

**Test**
```powershell
Describe "ConvertTo-VMRecord" {
    It "Creates a PSCustomObject with expected properties" {
        $input = @{ name = "web01"; power_state = "on" }
        $record = ConvertTo-VMRecord -InputObject $input
        $record | Should -HaveProperty "Name"
        $record | Should -HaveProperty "Status"
        $record.Name | Should -Be "web01"
    }
}
```

**Goal:**
Guarantee the **output contract** never changes silently.

---

## 9.6 Integration Testing (Adapter Layer)

Adapters handle external systems — REST APIs, databases, files.
These require *mocking* or *controlled environments* to stay stable.

### Example: Mocking a REST Request

**Function**
```powershell
function Invoke-SystemRequest {
    param([string]$Uri)
    Invoke-RestMethod -Uri $Uri
}
```

**Test**
```powershell
Describe "Invoke-SystemRequest" {
    Mock -CommandName Invoke-RestMethod -MockWith {
        return @{ name = "mockServer"; status = "ok" }
    }

    It "Calls REST API and returns expected data" {
        $result = Invoke-SystemRequest -Uri "https://mock/api"
        $result.status | Should -Be "ok"
        Assert-MockCalled Invoke-RestMethod -Times 1
    }
}
```

**Principle:**
Mock the I/O, not the logic.
Verify the adapter correctly passes through to PowerShell’s native I/O commands.

---

## 9.7 Contract Testing (Context Layer)

Context functions orchestrate multiple layers.
Their purpose is not to compute, but to produce *consistent and predictable results* from composed behavior.

**Function**
```powershell
function Find-Server {
    param([string]$Name)
    $data = Invoke-SystemRequest -Uri "https://api/servers?name=$Name"
    ConvertTo-ServerRecord -InputObject $data
}
```

**Test**
```powershell
Describe "Find-Server (Contract)" {
    Mock Invoke-SystemRequest { @{ name = "web01"; state = "running" } }
    Mock ConvertTo-ServerRecord { param($i) [PSCustomObject]@{ Name = $i.name; Status = $i.state } }

    It "Returns standardized server record" {
        $result = Find-Server -Name "web01"
        $result.Name   | Should -Be "web01"
        $result.Status | Should -Be "running"
    }
}
```

**Contract Rule:**
The function’s *shape of output* and *behavior under expected inputs* must stay consistent across versions.

---

## 9.8 Test Data and Fixtures

Keep test inputs under `/tests/data/` — never inline large blobs.

Example:
```
tests/data/vm_sample.json
tests/data/cluster_fixture.json
```

Use:
```powershell
Get-Content -Raw -Path "tests/data/vm_sample.json" | ConvertFrom-Json
```

Fixtures make tests reproducible and maintainable.

---

## 9.9 Mocking Patterns and Pitfalls

| Pattern | Purpose | Example |
|----------|----------|----------|
| **Mock external commands** | Avoid I/O in unit tests | `Mock Invoke-RestMethod` |
| **Mock helper functions** | Isolate the function under test | `Mock ConvertTo-VMRecord` |
| **Assert-MockCalled** | Verify interaction behavior | Confirm invocation count |
| **Avoid overmocking** | Don’t mock the function you’re testing | Preserves integrity |

Avoid nested mocks for orchestration — test behavior, not internals.

---

## 9.10 Test Naming and Structure

Follow a consistent hierarchy:

```
Describe "FunctionName" {
    Context "When given valid input" {
        It "Returns expected output" { ... }
    }
}
```

- **Describe** → the function or feature
- **Context** → the scenario
- **It** → the expectation

**Example:**
```powershell
Describe "ConvertTo-VMRecord" {
    Context "With valid input" {
        It "Maps properties correctly" { ... }
    }
    Context "With missing input" {
        It "Throws a useful error" { ... }
    }
}
```

---

## 9.11 Code Coverage

Run coverage as part of CI:

```powershell
Invoke-Pester -CodeCoverage "$PSScriptRoot\Modules\PE.Compute.Common"
```

Set thresholds in your build config (e.g., 70%) but focus on **meaningful coverage** — tests that protect contracts, not just lines executed.

---

## 9.12 Testing Configuration Files

Pester can validate `.psd1` and `.json` schema consistency.

**Example**
```powershell
Describe "Provider.Nutanix.psd1" {
    It "Has required keys" {
        $cfg = Import-PowerShellDataFile "data\Provider.Nutanix.psd1"
        $cfg.Clusters.Keys | Should -Contain "Prism"
    }
}
```

This catches typos or accidental deletions early.

---

## 9.13 Continuous Testing Integration

Testing is most effective when automated:

| Platform | Trigger | Action |
|-----------|----------|--------|
| GitHub Actions | On push/PR | Run `Invoke-Pester` |
| Azure DevOps | Build stage | Run tests with coverage |
| Jenkins | Pipeline stage | Test before deployment |

Example YAML for GitHub Actions:
```yaml
- name: Run Pester Tests
  shell: pwsh
  run: |
    Install-Module Pester -Force -Scope CurrentUser
    Invoke-Pester -Output Detailed
```

---

## 9.14 Quality Gates and Review Checklist

| Category | Question | Expectation |
|-----------|-----------|-------------|
| **Unit Tests** | Does every Core/Domain function have coverage? | Yes |
| **Adapters** | Are REST calls mocked properly? | Yes |
| **Contracts** | Are public outputs validated? | Yes |
| **Performance** | Are large loops tested with minimal data? | Yes |
| **Error Handling** | Are exceptions predictable and readable? | Yes |
| **CI Integration** | Does testing run automatically? | Yes |

---

## 9.15 Common Testing Anti-Patterns

| Anti-Pattern | Symptom | Solution |
|---------------|----------|-----------|
| Mocking everything | Tests don’t reflect reality | Mock only boundaries |
| Output not validated | No structure guarantees | Assert output shape |
| Coupled tests | Break after refactor | Test behavior, not implementation |
| Hidden dependencies | Global vars or paths | Pass dependencies explicitly |
| Manual test data | Hard to maintain | Use fixtures or generated data |

---

## 9.16 Example End-to-End Test Flow

```
Describe "Find-VM End-to-End" {
    Mock Invoke-NtxRequest { @{ name = "web01"; power_state = "on" } }
    It "Returns normalized VM record" {
        $vm = Find-VM -Names "web01"
        $vm.Name | Should -Be "web01"
        $vm.Status | Should -Be "on"
    }
}
```

**Flow Diagram**
```
Find-VM (Context)
   ↓
Invoke-NtxRequest (Adapter, mocked)
   ↓
ConvertTo-VMRecord (Domain)
   ↓
Returns PSCustomObject with Name + Status
```

---

## 9.17 Summary

| Layer | Test Focus | Tooling |
|--------|-------------|----------|
| Core | Pure logic, no I/O | Unit tests |
| Domain | Transformations, validation | Unit tests |
| Adapter | REST / API behavior | Integration + Mocks |
| Context | Orchestration, contracts | QA / Contract tests |

**Key Principles**
- Write tests that **verify contracts**, not implementations.
- Prefer **mocking I/O**, not logic.
- Keep tests readable — they are executable documentation.
- Automate everything — testing is part of the build, not an afterthought.

---

## Next Chapter

Continue to **Chapter 10 — Error Handling and Observability**,
where we formalize structured logging, consistent exceptions, and tracing patterns for resilient automation.
