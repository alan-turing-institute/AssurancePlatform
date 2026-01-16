# Word Generation Library Evaluation

**Issue:** AssurancePlatform-aeb.3.3
**Date:** 2026-01-16
**Status:** Complete

---

## Executive Summary

**Recommendation: `docx` library**

The `docx` library is the clear choice for implementing Word export in the TEA Platform. It is actively maintained, has comprehensive features, excellent TypeScript support, and aligns perfectly with the existing export architecture.

---

## Evaluation Criteria Results

| Criteria | `docx` | `officegen` |
|----------|--------|-------------|
| **Maintenance Status** | Active (v9.5.1, June 2025) | Inactive (v0.6.5, last updated 2020) |
| **Weekly Downloads** | ~1.35M | ~16K |
| **TypeScript Support** | Native (100% TypeScript) | No native types |
| **Image Embedding** | Full support | Supported |
| **Table Support** | Full support | Limited |
| **Style Support** | Comprehensive | Basic |
| **Browser + Node.js** | Both | Node.js only |
| **Open Issues** | ~50 | 182 |
| **Contributors** | 120+ | Limited |
| **Dependents** | 13.1K projects | 60 projects |

---

## Detailed Analysis

### 1. `docx` Library (Recommended)

**Strengths:**
- **Actively maintained** with recent release (v9.5.1, June 2025)
- **100% TypeScript** - aligns with TEA Platform's strict typing requirements
- **Declarative API** - similar pattern to `@react-pdf/renderer` already used
- **Comprehensive features**: headings, paragraphs, tables, lists, images, headers/footers
- **Works in both Node.js and browser** - flexible for server actions
- **Well-documented** at docx.js.org with examples
- **Large community** - 120+ contributors, 13.1K dependent projects

**Bundle Size:**
- Estimated ~300-400KB minified (comparable to react-pdf)
- Server-side only usage means bundle size is less critical

**Capabilities for TEA Platform:**
- Headings (6 levels) for element hierarchy
- Styled paragraphs for descriptions/justifications
- Tables for metadata and evidence summaries
- Images for diagram embedding (base64 support)
- Headers/footers for branding
- Table of contents generation
- Custom colours and fonts for branding

### 2. `officegen` Library (Not Recommended)

**Weaknesses:**
- **Unmaintained** - last release 5 years ago (2020)
- **No TypeScript support** - violates TEA Platform coding standards
- **182 open issues** with no recent activity
- **18 stale pull requests**
- **Limited documentation** and examples
- **Node.js only** - no browser support

**Risks:**
- Security vulnerabilities unlikely to be patched
- No support for newer Node.js features
- Potential compatibility issues with future dependencies

---

## Architecture Alignment

The TEA Platform's export system uses a **registry pattern** with abstract exporters:

```
AbstractExporter -> PDFExporter (using @react-pdf/renderer)
                 -> MarkdownExporter
                 -> WordExporter (to be implemented with docx)
```

The `docx` library fits this pattern perfectly:
- Similar declarative approach to `@react-pdf/renderer`
- Content blocks can be mapped directly to docx elements
- Server-side execution in Next.js Server Actions

---

## Implementation Approach

### Key Files to Create/Modify:
1. `lib/export/exporters/word-exporter.ts` - New WordExporter class
2. `lib/export/index.ts` - Register WordExporter
3. `package.json` - Add `docx` dependency

### Content Block Mapping:
| ContentBlock | docx Element |
|--------------|--------------|
| HeadingBlock | `Paragraph` with `HeadingLevel` |
| ParagraphBlock | `Paragraph` |
| ListBlock | `Paragraph` with bullet/numbering |
| TableBlock | `Table` with `TableRow`/`TableCell` |
| ImageBlock | `ImageRun` with base64 data |
| DividerBlock | `Paragraph` with border |
| MetadataBlock | `Table` or styled paragraphs |
| ElementBlock | Recursive paragraph generation |

---

## Sources

- [docx on npm](https://www.npmjs.com/package/docx)
- [docx GitHub repository](https://github.com/dolanmiu/docx)
- [officegen on npm](https://www.npmjs.com/package/officegen)
- [officegen Snyk analysis](https://snyk.io/advisor/npm-package/officegen)
- [officegen GitHub repository](https://github.com/Ziv-Barber/officegen)
