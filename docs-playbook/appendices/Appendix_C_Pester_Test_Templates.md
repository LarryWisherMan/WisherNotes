---
id: appendix-c
title: Appendix C – Pester Test Templates
sidebar_position: 3
description: Unit, integration, and contract test templates.
---

> “Testing is not about proving code works — it’s about proving it still works tomorrow.”

This appendix provides reusable templates and best practices for writing consistent, maintainable tests using **Pester 5**.
Each example aligns directly with the playbook’s architectural layers — ensuring your tests validate contracts, not just implementation.

---

## C.1 Purpose of Testing

PowerShell testing serves three goals:

| Goal | Description |
|------|--------------|
| **Verification** | Ensure each function behaves as expected. |
| **Regression Protection** | Prevent accidental breakage when refactoring. |
| **Documentation** | Tests describe how the function is intended to be used. |

> In engineering terms: a test is an *executable contract*.

---

## C.2 Recommended Test Folder Structure

```
tests/
  Unit/
    Core/
    Domain/
  Integration/
    Adapter/
  Contract/
    Context/
  QA/
```

Each folder maps to a layer:

| Layer | Test Type | Purpose |
|--------|------------|----------|
| Core | Unit | Validate pure functions. |
| Domain | Unit | Validate transformations and rules. |
| Adapter | Integration | Test REST or external behavior (mocked or stubbed). |
| Context | Contract | Test end-to-end consistency. |

---

## C.3 General Pester 5 Template

Use this structure for all tests:

```powershell
# In tests/Unit/Core/Invoke-Retry.tests.ps1
Import-Module "$PSScriptRoot/../../output/module/PE.Compute.Common.psd1" -Force

Describe 'Invoke-Retry' {

    Context 'When the action succeeds immediately' {
        It 'Returns the action result' {
            $result = Invoke-Retry -Action { 42 }
            $result | Should -Be 42
        }
    }

    Context 'When the action fails once then succeeds' {
        It 'Retries and eventually returns the result' {
            $attempts = 0
            $result = Invoke-Retry -Action {
                $script:attempts++
                if ($script:attempts -lt 2) { throw "Fail" }
                return "Success"
            }
            $result | Should -Be 'Success'
        }
    }

    Context 'When the action keeps failing' {
        It 'Throws an error after all attempts' {
            { Invoke-Retry -Action { throw "Always fail" } -Attempts 2 } |
                Should -Throw "Always fail"
        }
    }
}
```

**Pattern**
- One function per `Describe` block.
- Each `Context` represents a distinct condition.
- Each `It` represents one expected outcome.

---

## C.4 Core Layer Example — Pure Functions

Core tests validate deterministic utilities with no I/O or dependencies.

**Function Under Test:** `New-ComputeODataFilter`

```powershell
Describe 'New-ComputeODataFilter' {

    It 'Builds equals filter for simple names' {
        $filter = New-ComputeODataFilter -Names 'vm01'
        $filter | Should -Be "(tolower(name) eq 'vm01')"
    }

    It 'Builds startswith filter when -StartsWith is used' {
        $filter = New-ComputeODataFilter -Names 'sql' -StartsWith
        $filter | Should -Be "startswith(tolower(name),'sql')"
    }

    It 'Joins multiple names with OR' {
        $filter = New-ComputeODataFilter -Names 'a','b'
        $filter | Should -Match 'or'
    }
}
```

**Why**
- No mocks are needed.
- Tests focus purely on input → output transformation.

---

## C.5 Domain Layer Example — Business Logic

Domain tests validate transformation and consistency of business entities.

**Function Under Test:** `ConvertTo-VMRecord`

```powershell
Describe 'ConvertTo-VMRecord' {

    It 'Normalizes VM input into a record' {
        $input = @{ name = 'vm01'; power_state = 'on'; cluster_name = 'core' }
        $result = ConvertTo-VMRecord -InputObject $input

        $result.Name        | Should -Be 'vm01'
        $result.Status      | Should -Be 'on'
        $result.ClusterName | Should -Be 'core'
    }

    It 'Assigns a PSTypeName for contract versioning' {
        $input = @{ name = 'vm02'; power_state = 'off' }
        $result = ConvertTo-VMRecord -InputObject $input
        $result.PSTypeNames | Should -Contain 'PE.Compute.VMRecord.v1'
    }
}
```

**Why**
- Confirms domain logic outputs consistent data structure.
- Guarantees contract stability for downstream consumers.

---

## C.6 Adapter Layer Example — REST Integration

Adapters are the most complex to test because they touch external systems.
The key is **mocking** — simulate REST behavior without making real network calls.

**Function Under Test:** `Invoke-NtxRequest`

```powershell
Describe 'Invoke-NtxRequest' {

    Mock Invoke-RestMethod {
        return @{ data = @{ name = 'vm01'; power_state = 'on' } }
    }

    It 'Builds correct API URI and returns data' {
        $session = [PSCustomObject]@{
            ServerUri  = 'https://prism.local:9440'
            Credential = (New-Object PSCredential 'admin',(ConvertTo-SecureString 'x' -AsPlainText -Force))
        }

        $result = Invoke-NtxRequest -Session $session -ApiPath 'vms/list'
        $result.data.name | Should -Be 'vm01'
    }

    It 'Throws a descriptive error on failure' {
        Mock Invoke-RestMethod { throw "Network error" }
        { Invoke-NtxRequest -Session $session -ApiPath 'vms/list' } |
            Should -Throw 'Network error'
    }
}
```

**Why**
- Protects from network flakiness.
- Tests URI and header logic, not connectivity.

---

## C.7 Context Layer Example — Contract Tests

Context-level tests verify user-facing behavior and composition of layers.

**Function Under Test:** `Find-VM`

```powershell
Describe 'Find-VM' {

    Mock Invoke-NtxRequest {
        return @{ data = @(
            @{ name = 'vm01'; power_state = 'on'; cluster_name = 'core' }
        )}
    }

    It 'Returns VM records with expected properties' {
        $session = [PSCustomObject]@{
            ServerUri  = 'https://prism.local:9440'
            Credential = (New-Object PSCredential 'admin',(ConvertTo-SecureString 'x' -AsPlainText -Force))
        }

        $result = Find-VM -Names 'vm01' -Session $session
        $result | Should -BeOfType PSCustomObject
        $result.Name | Should -Be 'vm01'
    }

    It 'Can process multiple names in pipeline' {
        $results = 'vm01','vm02' | Find-VM -Session $session
        $results.Count | Should -Be 2
    }
}
```

**Why**
- Ensures end-to-end composition behaves predictably.
- Confirms pipeline support and correct output contracts.

---

## C.8 Contract Test Pattern

Contract tests verify **stability** rather than logic — ensuring outputs and parameters haven’t changed between versions.

```powershell
Describe 'Find-VM Contract' {

    It 'Exports the correct parameters' {
        (Get-Command Find-VM).Parameters.Keys |
            Should -Contain 'Names'
    }

    It 'Outputs records with expected fields' {
        $sample = Find-VM -Names 'demo' -Session $session
        $sample | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name |
            Should -Contain 'Name'
    }
}
```

**Why**
- Protects backward compatibility.
- Guards against unintentional API drift.

---

## C.9 QA / Integration Pattern

Use a `tests/QA` folder for environment-aware integration tests.
These may require credentials or environment variables.

```powershell
Describe 'Nutanix API Integration (QA)' -Tag 'Integration' {

    BeforeAll {
        $credential = Get-Credential
        $session = New-NtxProviderSession -Credential $credential -Cluster 'Prism'
    }

    It 'Retrieves at least one VM from real API' {
        $result = Find-VM -Session $session -Names 'vm'
        $result.Count | Should -BeGreaterThan 0
    }
}
```

**Tip:**
Use `-Tag 'Integration'` to run these selectively:
```powershell
Invoke-Pester -Tag 'Integration'
```

---

## C.10 Testing Guidelines Summary

| Category | Practice | Description |
|-----------|-----------|--------------|
| **Isolation** | Unit tests mock dependencies | Never depend on network or file system. |
| **Repeatability** | Tests deterministic | Same input → same output. |
| **Behavioral Validation** | Test contracts, not lines of code | Verify what, not how. |
| **Naming** | One function per `Describe` | Easier navigation and reports. |
| **Coverage** | Test all public functions | Especially adapters and contexts. |
| **Environment** | Separate QA/integration | Prevents contamination of local dev runs. |

---

## C.11 Quick Test Checklist

| Question | Expectation |
|-----------|-------------|
| Does it mock external calls? | ✅ |
| Does it verify contracts, not internals? | ✅ |
| Is it deterministic and repeatable? | ✅ |
| Does it validate input/output shapes? | ✅ |
| Is the test name readable as a sentence? | ✅ |

---

## C.12 Summary

Good testing practices enforce discipline across the lifecycle:
- **Core tests** guarantee stability.
- **Domain tests** verify correctness.
- **Adapter tests** ensure resilience.
- **Context tests** maintain contract stability.

Together, they provide a **living proof** that your PowerShell architecture is working — and will keep working as it evolves.

---

**Next Appendix →**
[Appendix D — Example Provider Configurations (psd1)](Appendix_D_Provider_Configuration_Examples.md)
