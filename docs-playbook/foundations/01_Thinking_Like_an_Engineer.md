---
id: thinking-like-an-engineer
title: Thinking Like an Engineer
sidebar_position: 1
description: Transition from scripting to engineering — build predictable, reusable, and testable logic.
---

> “Scripts solve problems; engineering prevents them.”

This chapter establishes the mental shift from *scripting* to *engineering*.
It introduces the guiding ideas of structure, predictability, and collaboration that underlie everything that follows in this playbook.

---

## 1.1 Purpose of This Chapter

Many PowerShell users begin as task automators — writing short scripts that “get the job done.”
As the environment grows, scripts accumulate complexity, implicit dependencies, and hidden assumptions.

**Engineering thinking** is the deliberate move toward:

- **Repeatability** — the same command always produces the same outcome.
- **Resilience** — predictable handling of errors and external systems.
- **Reusability** — logic designed to be used by others, not just you.
- **Maintainability** — code that can be understood and extended months later.

The purpose of this chapter is to show how these principles apply to PowerShell through concrete design decisions.

---

## 1.2 The Evolution from Script to System

Below is a conceptual illustration of how small ad-hoc scripts mature into engineered modules.

```
┌────────────────────┐
│  Ad-hoc Script     │  →  Quick, manual solution.
└────────┬───────────┘
│
▼
┌────────────────────┐
│  Reusable Function │  →  Logic isolated; accepts parameters.
└────────┬───────────┘
│
▼
┌────────────────────┐
│  Modular Component │  →  Shared module; tested and versioned.
└────────┬───────────┘
│
▼
┌────────────────────┐
│  Engineered System │  →  Structured by layers, reusable, observable.
└────────────────────┘
```

Each step requires more intentional design:
- Clear **inputs and outputs**
- Consistent **error behavior**
- Independent **testability**

---

## 1.3 From “Works on My Machine” to Reliable Automation

A well-engineered PowerShell function behaves the same:
- In CI/CD pipelines
- On any workstation or server
- Across multiple environments (e.g., test, prod)

### Example: Unreliable vs. Reliable Design

**Unreliable:**

```powershell
function Get-ServerStatus {
    param($ServerName)
    ping $ServerName
}
```

This works locally but fails in restricted networks and returns unpredictable text.

**Reliable:**

```powershell
function Get-ServerStatus {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ServerName
    )

    try {
        $ping = Test-Connection -ComputerName $ServerName -Count 1 -Quiet
        [PSCustomObject]@{
            ServerName = $ServerName
            IsOnline   = $ping
        }
    }
    catch {
        Write-Error "Unable to reach server '$ServerName': $($_.Exception.Message)"
    }
}
```

The second version:
- Declares parameter types.
- Returns consistent structured output.
- Handles errors gracefully.
- Can be tested without depending on external scripts.

---

## 1.4 Building for Others

PowerShell engineers rarely write for themselves.
Your future self, teammates, or another automation system will consume your functions.
Therefore:

| Concern | Script Mindset | Engineering Mindset |
|----------|----------------|--------------------|
| Goal | Make it work | Make it reliable |
| Scope | Solves one case | Handles multiple scenarios |
| Structure | Inline logic | Layered functions |
| Error handling | Ad hoc | Predictable and standardized |
| Sharing | Copy-paste | Versioned module |
| Testing | Manual reruns | Automated validation |

---

## 1.5 Design as Communication

Clean code is communication, not just computation.
It should be immediately clear to another engineer what a function does, why it exists, and how it behaves.

**Example — bad naming vs. good naming:**

```powershell
# Poor: ambiguous verb
function RunCheck {
    # What is being checked? Why?
}

# Improved: clear intent
function Test-ServerConnectivity {
    # Returns $true or $false
}
```

### Verb–Noun Pairs Matter

| Verb | Behavior Type | Example |
|------|----------------|---------|
| Get | Query | Get-Server |
| Find | Search (Query) | Find-Job |
| Test | Predicate | Test-ConfigValid |
| Set | Mutator (change state) | Set-ServerMode |
| New | Mutator (create state) | New-JobDefinition |
| ConvertTo | Transform | ConvertTo-ServerRecord |
| Write | Presenter | Write-JobSummary |

This vocabulary becomes the team’s **ubiquitous language**, forming the foundation for modular design.

---

## 1.6 Layered Thinking

Before writing code, identify where the logic belongs:

| Layer | Description | Example |
|--------|--------------|---------|
| Core | Reusable utilities, no domain references | Invoke-Retry, New-Uri |
| Domain | Rules, validation, transformations | ConvertTo-ServerRecord |
| Context | User-facing workflows | Find-Server |
| Adapter | External system access | Invoke-RestRequest |

This structure prevents tangling logic — for instance, a context function should never know how authentication works; it should only call a domain or adapter function that handles it.

---

## 1.7 Example: Thinking in Layers

**Goal:** Retrieve all running jobs from a system API.

**Step 1 — Define Intent**

What is the user asking for?
“Show me all running jobs.”
This means a *query* (read-only).

**Step 2 — Express Layers**

```
[Context]     Get-JobList
   ↓ calls
[Domain]      ConvertTo-JobRecord
   ↓ calls
[Adapter]     Invoke-SystemRequest
   ↓ calls
[Core]        Invoke-RestRequest
```

Each layer isolates one responsibility:
- Core handles the transport.
- Adapter shapes requests/responses.
- Domain standardizes records.
- Context defines the user experience.

---

## 1.8 Principles to Begin Every Function

When designing a new function:
1. Define what it does, not how it works internally.
2. Write the help synopsis before code — this clarifies intent.
3. Decide whether it is a query, transform, or mutator.
4. Determine its layer (Core, Domain, Context, Adapter).
5. Ensure it has one reason to change (Single Responsibility).
6. Return structured data — not console text.

---

## 1.9 Exercises and Patterns

### Exercise 1 — Refactoring a Script
Take a raw PowerShell script that manages servers.
Refactor it into:
- A private Core function (pure logic).
- A Context function that handles orchestration.
- A reusable Domain function that validates data.

### Exercise 2 — Identify Function Type
For each command below, identify if it’s a Query, Mutator, or Transform:
- Get-ServerStatus
- Set-ServerMaintenanceMode
- ConvertTo-ServerRecord

### Exercise 3 — Predict the Layer
Decide where each belongs:
- Invoke-SystemRequest
- Find-Server
- Test-ServerCredentials

---

## 1.10 Summary

| Key Idea | Description |
|-----------|-------------|
| Think in layers | Separate logic from infrastructure early. |
| Design for users | Write for reusability and clarity. |
| Communicate intent | Use verbs, names, and help text consistently. |
| Ensure predictability | Handle inputs, outputs, and errors consistently. |
| Start small | Evolve scripts gradually into modular systems. |

---

## Next Chapter

Continue to **Core Concepts** to learn how design principles like
DDD, Clean Architecture, and CQRS apply directly to PowerShell module structure.
