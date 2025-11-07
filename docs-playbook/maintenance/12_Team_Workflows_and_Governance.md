---
id: team-workflows-and-governance
title: Team Workflows and Governance
sidebar_position: 12
description: Establishing team standards, reviews, and CI/CD integration.
---

> “A good engineering culture turns consistency into momentum.”

This chapter defines how teams collaborate effectively when building, maintaining, and releasing PowerShell modules.
It covers version control, branching strategy, code review practices, CI/CD automation, and governance policies that ensure reliability and repeatability across environments.

---

## 12.1 Why Governance Matters

Governance isn’t bureaucracy — it’s a framework that keeps teams productive and code predictable.

Without shared rules, modules evolve in isolation:

| Problem                   | Symptom              | Result                    |
| ------------------------- | -------------------- | ------------------------- |
| No shared branching model | Colliding commits    | Frequent merge conflicts  |
| No review discipline      | Inconsistent quality | Hidden regressions        |
| No automated testing      | Manual verification  | Slow, unreliable releases |
| No release process        | Ad hoc builds        | Lost version history      |

Governance gives structure to collaboration so that **speed does not come at the expense of stability**.

---

## 12.2 The Four Pillars of Team Governance

```
┌────────────────────────────────┐
│   1. Source Control Discipline  │
│   2. Review and Quality Gates   │
│   3. Automated Testing & CI/CD  │
│   4. Documentation & Traceability │
└────────────────────────────────┘
```

Each pillar is simple but powerful: together they create an ecosystem where engineers can move fast without fear of breaking things.

---

## 12.3 Version Control Standards

### Repository Layout

Use one of these repository models depending on team scale:

| Model                  | Description                           | When to Use                                |
| ---------------------- | ------------------------------------- | ------------------------------------------ |
| **Single-module repo** | One PowerShell module per repository  | Small or focused utilities                 |
| **Monorepo**           | Multiple related modules sharing code | Team-scale platform (e.g., `PE.Compute.*`) |

### Recommended Structure (Monorepo)

```
/src/
  PE.Core/
  PE.Compute.Core/
  PE.Compute.Providers/
  PE.Compute.Discovery/
  PE.Server/

/tests/
  Unit/
  Integration/
  QA/

/docs/
  architecture/
  api/
  governance/
```

### Branching Strategy

Adopt a clear and predictable model:

```
main     → always stable (released versions)
develop  → integration branch (feature merges)
feature/* → new features or experiments
hotfix/*  → emergency patches
release/* → staging branch for tagged releases
```

Each merge into **main** must:

1. Pass all automated tests.
2. Update changelog and module version.
3. Be peer-reviewed and approved.

---

## 12.4 Commit and Pull Request Standards

### Commit Guidelines

Each commit should be **atomic** — one logical change only.

| Type     | Prefix      | Example                                      |
| -------- | ----------- | -------------------------------------------- |
| Feature  | `feat:`     | `feat: Add new Azure provider configuration` |
| Fix      | `fix:`      | `fix: Correct VM filter logic`               |
| Refactor | `refactor:` | `refactor: Extract New-ComputeUri helper`    |
| Docs     | `docs:`     | `docs: Update function examples`             |
| Test     | `test:`     | `test: Add Pester coverage for adapter`      |
| Chore    | `chore:`    | `chore: Update dependencies`                 |

### Pull Request Template

All PRs should use a structured template:

```
### Summary
Short description of change.

### Type of Change
- [ ] Feature
- [ ] Fix
- [ ] Refactor
- [ ] Documentation

### Breaking Change
- [ ] Yes (explain below)
- [ ] No

### Testing
Describe validation performed (unit, integration, etc.)

### Linked Issues
Fixes #
```

---

## 12.5 Review Workflow

Code reviews ensure quality and shared ownership.

### Review Steps

| Step               | Reviewer Responsibility                              |
| ------------------ | ---------------------------------------------------- |
| **1. Readability** | Can another engineer understand this easily?         |
| **2. Scope**       | Does the function do one thing (SRP)?                |
| **3. Safety**      | Are errors handled and logged predictably?           |
| **4. Consistency** | Naming, layering, and contracts follow the playbook? |
| **5. Tests**       | Are new or changed behaviors tested?                 |
| **6. Docs**        | Are examples and help updated?                       |

### Review Outcomes

- **Approve** — Meets all standards.
- **Request Changes** — Feedback with clear next steps.
- **Block** — Fails critical checks (tests, contract breaks).

> Remember: Reviews are for the code, not the coder.
> Keep discussions factual, constructive, and grounded in shared standards.

---

## 12.6 Automated Testing Integration

Continuous Integration (CI) ensures every commit is validated automatically.

### Core Principles

1. All tests must be runnable locally with `Invoke-Pester`.
2. CI runs the same suite on every push and PR.
3. Failures block merges into main.

### Example GitHub Actions Workflow

```yaml
name: PowerShell Module CI

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  build-test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install PowerShell
        uses: PowerShell/setup-pwsh@v2
      - name: Install Dependencies
        run: ./build.ps1 -ResolveDependency
      - name: Run Tests
        run: Invoke-Pester -Path tests -Output Detailed
```

---

## 12.7 Continuous Delivery (CD) and Publishing

After successful CI builds, publishing should be automated.

### Typical Workflow

1. Merge into `main`.
2. CI tags version (`vX.Y.Z`).
3. Build pipeline runs Sampler or ModuleBuilder.
4. Artifacts (NUPKG) are pushed to:
   - Internal Azure Artifacts feed, or
   - Internal PSGallery repository.

### Example CD Step

```yaml
- name: Publish Module
  if: startsWith(github.ref, 'refs/tags/v')
  run: |
    ./build.ps1 -Tasks pack
    ./build.ps1 -Tasks publish
```

Version bumps are handled in the module manifest or via release automation.

---

## 12.8 Security and Secrets Governance

Automation often touches sensitive systems.
Teams must enforce secure patterns consistently.

### Rules

| Principle                | Implementation                               |
| ------------------------ | -------------------------------------------- |
| No plaintext secrets     | Use `Get-Credential`, DPAPI, or secure vault |
| Limit access scope       | Store credentials per environment            |
| Rotate secrets regularly | Via policy or CI integration                 |
| Never hardcode secrets   | Even in private repos                        |

### Example: Credential Pattern

```powershell
$cred = Get-Credential -Message "Enter service account"
New-NtxProviderSession -Credential $cred -Cluster 'Prism'
```

If you must automate non-interactive authentication, store credentials encrypted with DPAPI or an enterprise vault.

---

## 12.9 Release Documentation and Traceability

### Required Artifacts

| Artifact       | Purpose                                     |
| -------------- | ------------------------------------------- |
| `CHANGELOG.md` | Summarize each release                      |
| `README.md`    | Explain module usage                        |
| `docs/`        | Contain design notes and governance details |
| Git tags       | Trace commits to versions                   |
| Release notes  | Context for users and management            |

### Example Changelog Entry

```
## [1.3.0] - 2025-05-22
### Added
- New `Find-Cluster` command for hybrid inventory.
### Fixed
- Pagination handling in Nutanix adapter.
```

---

## 12.10 Quality Gates

Quality gates define minimum criteria for merging or releasing code.

| Category   | Gate                       | Tool                          |
| ---------- | -------------------------- | ----------------------------- |
| Syntax     | No PSScriptAnalyzer errors | PSScriptAnalyzer              |
| Tests      | All Pester tests pass      | Pester                        |
| Coverage   | ≥ 70%                      | Codecov or JaCoCo             |
| Docs       | Help and changelog updated | PR template check             |
| Versioning | Manifest incremented       | CI step                       |
| Review     | At least one peer approval | GitHub or Azure DevOps policy |

These gates ensure every release is reliable by design.

---

## 12.11 Governance Roles

| Role                  | Responsibility                           |
| --------------------- | ---------------------------------------- |
| **Module Maintainer** | Reviews PRs, manages releases            |
| **Contributor**       | Implements changes following guidelines  |
| **CI/CD Engineer**    | Maintains pipelines and test runners     |
| **Architect/Lead**    | Owns overall structure and design vision |

Governance scales through shared ownership — not gatekeeping.

---

## 12.12 Cultural Practices for Healthy Collaboration

### Encourage:

- Small, frequent commits.
- Clear communication in PRs.
- Teaching through reviews.
- Shared documentation ownership.

### Avoid:

- “Cowboy coding” (direct pushes to main).
- Unreviewed merges.
- Long-lived feature branches.
- Hidden design decisions.

Governance thrives when teams share context and respect process.

---

## 12.13 Governance Checklist

| Category            | Question                          | Expectation |
| ------------------- | --------------------------------- | ----------- |
| **Version Control** | Are branches and tags consistent? | Yes         |
| **Code Review**     | Was every change peer-reviewed?   | Yes         |
| **Testing**         | Are tests automated in CI?        | Yes         |
| **Security**        | Are secrets handled securely?     | Yes         |
| **Documentation**   | Are help and changelogs updated?  | Yes         |
| **Quality Gates**   | Did all required checks pass?     | Yes         |
| **Release**         | Is version bump documented?       | Yes         |

---

## 12.14 Summary

| Concept         | Practice                                           |
| --------------- | -------------------------------------------------- |
| Governance      | Shared standards that scale quality                |
| Version Control | Predictable branching and tagging                  |
| Reviews         | Constructive and consistent                        |
| CI/CD           | Automate testing and publishing                    |
| Security        | Never store secrets in code                        |
| Documentation   | Make design decisions transparent                  |
| Culture         | Encourage teaching, feedback, and shared ownership |

---

## Next Chapter

Continue to **Chapter 13 — Long-Term Evolution and Maturity Map**,
where we summarize the journey from ad-hoc scripts to a disciplined engineering platform, with maturity stages and indicators your team can measure over time.
