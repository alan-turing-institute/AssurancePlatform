# Shared Images Directory

**Purpose:** This directory contains images, diagrams, and visual assets used across multiple curriculum modules.

**Last Updated:** November 2025

---
## Directory Purpose

The `shared/images/` directory stores visual resources that are:

  - Used in more than one module
  - Applicable across multiple curriculum levels
  - Part of the core TEA methodology (e.g., element type diagrams, workflow illustrations)
  - Shared reference materials

**Module-specific images** should be stored in the Docusaurus `static/img/` directory and referenced appropriately.

---
## Image Naming Conventions

### Format

`[category]-[description]-[version].[extension]`

**Components:**

* `category`: Type of image (diagram, screenshot, illustration, icon, etc.)
* `description`: Kebab-case descriptive name
* `version`: Optional version number (v1, v2) if multiple versions exist
* `extension`: File format (svg, png, jpg, etc.)

### Examples

**Good:**

* `diagram-assurance-case-elements.svg`
* `illustration-argument-structure-v2.png`
* `screenshot-platform-navigation.png`
* `icon-goal-claim.svg`

**Avoid:**

* `image1.png` (not descriptive)
* `My Diagram.jpg` (spaces, not kebab-case)
* `FINAL_VERSION_2_EDITED.png` (unclear versioning)

---
## Supported Formats

### Preferred Formats

| Format       | Use Case                              | Notes                                             |
| ------------ | ------------------------------------- | ------------------------------------------------- |
| **SVG**      | Diagrams, icons, simple illustrations | Vector format, scales perfectly, small file size  |
| **PNG**      | Screenshots, images with transparency | Lossless compression, supports transparency       |
| **JPG/JPEG** | Photographs, complex images           | Smaller file size, no transparency                |
| **WebP**     | Modern alternative to JPG/PNG         | Better compression, not universally supported yet |

### Format Guidelines

* **Prefer SVG** for any diagram or illustration that can be created as vector graphics
* **Use PNG** for screenshots and images requiring transparency
* **Use JPG** only for photographic content where file size is a concern
* **Avoid GIF** unless animation is specifically required

---
## Image Size and Quality

### File Size

* **Target:** Keep individual images under 500KB when possible
* **Maximum:** 2MB for any single image
* **Optimization:** Use appropriate compression tools before committing

**Compression Tools:**

* SVG: [SVGOMG](https://jakearchibald.github.io/svgomg/)
* PNG: [TinyPNG](https://tinypng.com/)
* JPG: Image editing software (export at 80-85% quality)

### Dimensions

**Diagrams and illustrations:**

* **Width:** 800-1200px ideal
* **Maximum:** 2000px width
* **Height:** As needed, but consider readability

**Screenshots:**

* Capture at actual resolution
* Crop to relevant area only
* Consider retina displays (may need 2x resolution)

**Icons:**

* 24x24px to 128x128px depending on use
* SVG preferred for scalability

---
## Accessibility Requirements

### Alt Text

**Every image MUST have descriptive alt text** when used in modules.

**Alt Text Guidelines:**

* Describe the content and purpose of the image
* Be concise but complete (1-2 sentences maximum)
* Avoid "image of" or "picture of" (screen readers announce it's an image)
* For decorative images, use empty alt text: `alt=""`

**Examples:**

```markdown
<!-- Good alt text -->

![Diagram showing the five core elements of an assurance case: goal, property claims, strategies, evidence, and context](/img/diagram-core-elements.svg)

<!-- Poor alt text -->

![diagram](/img/diagram-core-elements.svg)

<!-- Decorative image -->

![](/img/decorative-element.svg)
```

### Color and Contrast

* Ensure diagrams don't rely solely on color to convey information
* Use patterns, labels, or shapes in addition to colors
* Maintain sufficient contrast (WCAG AA minimum: 4.5:1 for text)
* Test diagrams in grayscale to verify clarity

### Text in Images

* **Minimize text in images** (prefer SVG with actual text elements)
* If text is essential:
  * Use clear, readable fonts
  * Minimum 12pt font size
  * High contrast with background
  * Include text content in alt text or caption

---
## Referencing Images

### From Curriculum Modules

Images in this directory should be copied to `/static/img/` for use in documentation, or referenced via appropriate paths.

```markdown
<!-- Referencing from static/img -->

![Alt text description](/img/diagram-name.svg)

<!-- With caption -->

![Alt text description](/img/diagram-name.svg)
_Figure 1: Caption describing the diagram and its relevance_
```

### Linking vs. Embedding

**Embed (display) images when:**

* Image is essential to understanding the content
* Image provides visual explanation of concepts
* Image is part of a step-by-step tutorial

**Link to images when:**

* Image is supplementary or optional
* Image is very large
* Image is an alternative representation

---
## Attribution and Licensing

### Created for TEA

Images created specifically for the TEA platform:

* **License:** Same as repository (MIT License)
* **Attribution:** "TEA Platform Documentation"
* **Copyright:** Alan Turing Institute

### External Images

If using external images:

* **Check license** (must be compatible with MIT or allow educational use)
* **Provide attribution** in image caption or adjacent text
* **Link to source** where appropriate
* **Prefer open-licensed** images (CC BY, CC0, Public Domain)

**Attribution Format:**

```markdown
![Alt text](/img/image-name.png)
_Image source: [Author Name](link-to-source) (CC BY 4.0)_
```

---
## Image Categories

### Diagrams

**Technical diagrams** explaining TEA concepts:

* Assurance case structure diagrams
* Element type visualizations
* Workflow diagrams
* Architecture overviews

**Naming:** `diagram-[description].svg`

### Illustrations

**Visual metaphors and explanatory graphics:**

* Conceptual illustrations
* Process flows
* Comparative visuals

**Naming:** `illustration-[description].png` or `.svg`

### Screenshots

**Platform interface captures:**

* UI walkthroughs
* Feature demonstrations
* Example configurations

**Naming:** `screenshot-[feature]-[description].png`

**Best Practices:**

* Crop to relevant UI area
* Hide personal/sensitive information
* Use consistent window size when possible
* Annotate if needed (arrows, highlights)

### Icons

**Small graphics** for UI elements or callouts:

* Element type icons
* Status indicators
* Navigation symbols

**Naming:** `icon-[name].svg`

---
## Maintenance

### Regular Review

* **Quarterly:** Review for unused images (remove orphans)
* **On platform updates:** Update screenshots if UI has changed
* **Version updates:** Archive old versions, update references

### Version Control

When updating an image:

1. **Save new version** with incremented version number
2. **Update module references** to new version
3. **Keep old version** temporarily for backward compatibility
4. **Remove old version** after confirming all references updated

---
## Checklist for Adding Images

Before committing a new image, verify:

* \[ ] File name follows naming convention
* \[ ] File size is optimized (< 500KB ideal, < 2MB max)
* \[ ] Format is appropriate for content type
* \[ ] Image has been compressed/optimized
* \[ ] Dimensions are reasonable for web display
* \[ ] Attribution is documented (if external)
* \[ ] Alt text will be provided when image is used
* \[ ] Image serves a clear purpose in curriculum

---
## Tools and Resources

### Image Creation

* **Diagrams:** [Draw.io](https://draw.io), [Lucidchart](https://www.lucidchart.com), [Figma](https://www.figma.com)
* **Illustrations:** Figma, Adobe Illustrator, [Inkscape](https://inkscape.org/) (free)
* **Screenshots:** Built-in OS tools, [ShareX](https://getsharex.com/) (Windows), [Flameshot](https://flameshot.org/) (Linux)

### Optimization

* **SVG:** [SVGOMG](https://jakearchibald.github.io/svgomg/)
* **PNG/JPG:** [TinyPNG](https://tinypng.com/), [Squoosh](https://squoosh.app/)
* **Batch processing:** [ImageOptim](https://imageoptim.com/) (Mac), ImageMagick command-line

### Accessibility Testing

* **Color Contrast:** [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
* **Color Blindness:** [Coblis Simulator](https://www.color-blindness.com/coblis-color-blindness-simulator/)
* **Screen Readers:** NVDA (Windows), VoiceOver (Mac), ORCA (Linux)

---
## Questions or Issues

For questions about image requirements or to report issues:

* Review [STRUCTURE.md](../STRUCTURE.md) for broader documentation guidelines
* Open an issue on [GitHub](https://github.com/alan-turing-institute/AssurancePlatform/issues)
* Contact the Documentation Team Lead

---
**Version:** 1.0 | **Last Updated:** November 2025
