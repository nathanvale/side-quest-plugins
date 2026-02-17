# README Best Practices

Distilled from makeareadme.com, awesome-readme (20k+ stars), and community consensus.

## The Four Questions

Every README should let a visitor quickly determine:
1. **Does this solve my problem?** (Description/Overview)
2. **Can I use this code?** (Installation + Quick Start)
3. **Who made it?** (Contributors/Author)
4. **How can I learn more?** (Links to docs, contributing guide)

People judge software by the README. It is the project's best marketing material.

## Essential Sections (Priority Order)

1. **Project Name + Badges** -- Self-explanatory name. shields.io badges for build status, license, version. Instant credibility signals.
2. **Description/Overview** -- 1-2 paragraphs: what it does and why it exists. This is the elevator pitch.
3. **Highlights/Features** -- Short bulleted list of key selling points. Most people scan this first.
4. **Visuals** -- Screenshots, GIFs, or demo videos if applicable. People skim looking at pictures.
5. **Installation** -- One-liner install command. Save build-from-source for CONTRIBUTING.md.
6. **Quick Start/Usage** -- Smallest working code example with syntax highlighting. Link to advanced examples elsewhere.
7. **API Overview** -- High-level summary of main exports. Not per-function docs.
8. **Development** -- Dev scripts, testing, building from package.json.
9. **Contributing** -- Whether contributions are accepted, link to CONTRIBUTING.md.
10. **License** -- Always include one.

## Formatting Principles

- Front-load the most important info
- Use code blocks with syntax highlighting everywhere
- Keep it concise -- if getting long, link out to dedicated docs rather than cutting content
- Most visitors spend under 30 seconds deciding interest -- optimise for scanning

## Companion Files

Offload detailed content to separate files rather than overloading the README:
- CONTRIBUTING.md -- build-from-source, dev setup, PR guidelines
- CHANGELOG.md -- version history
- CODE_OF_CONDUCT.md -- community standards
- SECURITY.md -- vulnerability reporting
- .github/ templates -- issue and PR templates

## Badge Patterns

Common shields.io patterns for detected project signals:

- Build: `![CI](https://github.com/{owner}/{repo}/actions/workflows/{workflow}/badge.svg)`
- Version: `![npm](https://img.shields.io/npm/v/{package})`
- License: `![License](https://img.shields.io/badge/license-{license}-blue)`

Only generate badges that can be verified from project config.

## What Makes a README Stand Out

From the awesome-readme list (20k+ stars, 120+ contributors):
- Project logo or banner image
- GIF demos of key functionality
- Clean table of contents for longer READMEs
- Concise install instructions (ideally a one-liner)
- Real code examples with expected output
- Clear contribution guidelines
- Colorful, well-structured layout
