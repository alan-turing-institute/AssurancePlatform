# Contributing to the _Assurance Platform_

:tada::smile: **Welcome to the _Assurance Platform_ repository!** :smile::tada:

We hope that the information provided in this document will make it as easy as
possible for you to get involved.

This document explains how you can contribute to the project through this
repository and other means of engagement.

## Forms of Contribution

There are several ways you can contribute:

1. Improve code or features in the platform 💻
2. Improve our documentation (e.g. fixing typos or reporting bugs) 🪲
3. Support with community building 👥

The following sections explain each of these forms of contribution in more
detail, and offer guidance for contribution in general.

## How to Contribute

### General Guidance

All forms of contribution can be made through the following mechanisms:

- Opening a pull request
- Raising an issue
- Opening a thread for discussion

Before doing work or opening a pull request, it would be worth checking our
projects' page to see how the contribution may align or conflict with proposed
work.

When raising an issue, please check the open and closed issues to avoid
duplication.

Before opening a new thread for discussion, please check for existing threads
that cover the same or similar points to avoid duplication.

### Contributing to our Code

Please remember to enable `pre-commit` and run it before any push or PR.

```bash
pre-commit install
pre-commit run a--all-files
```

### Contributing to the Documentation

We use [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/) to
generate our documentation site. All documentation is written in markdown, and
any contributions should be made following this format.

If you are new to Markdown, GitHub has a helpful page on
[getting started with writing and formatting on GitHub](https://help.github.com/articles/getting-started-with-writing-and-formatting-on-github).
And, the
[documentation for Material for MkDocs](https://squidfunk.github.io/mkdocs-material/reference/)
also has excellent support on additional syntax and styling.

When writing in Markdown, please start each new sentence on a new line. Having
each sentence on a new line will make no difference to how the text is
displayed, there will still be paragraphs, but it makes the
[diffs produced during the pull request](https://help.github.com/en/articles/about-comparing-branches-in-pull-requests)
review easier to read! :sparkles:

We are grateful for all suggestions and contributions. This can include typos,
content issues (e.g. missing references, false or problematic statements),
improvements to our community documentation (e.g. README files), and any
technical issues (e.g. problems with pages not rendering correctly, or
improvements to the code base). If you are unsure of whether a more substantive
contribution is likely to be accepted (e.g. new section), please feel free to
reach out in advance (e.g. open a new issue or discussion).

## Recognising Contributions

We welcome and recognise all kinds of contributions, from fixing small errors,
to developing documentation, maintaining the project infrastructure, writing
chapters or reviewing existing resources. The _Assurance Platform_ repository
follows the [all-contributors][all-contributors] specifications. The
all-contributors bot usage is described
[here](https://allcontributors.org/docs/en/bot/usage). You can see a list of
current contributors
[here](https://github.com/alan-turing-institute/AssurancePlatform#contributors).
😍

To add yourself or someone else as a contributor, comment on
[this issue](https://github.com/alan-turing-institute/AssurancePlatform/issues/187)
using the following statement:

```
@all-contributors please add <username> for <contributions>
```

You will need to edit this accordingly following the instructions on
[the @all-contributors guide](https://allcontributors.org/docs/en/bot/usage),
including the relevant contribution type. See
[Emoji Key (Contribution Types Reference)](https://allcontributors.org/docs/en/emoji-key)
for a list of valid `<contribution>` types. The bot will then create a Pull
Request to add the contributor and reply with the pull request details.

**PLEASE NOTE: Only one contributor can be added with the bot at a time!**

[all-contributors]: https://github.com/kentcdodds/all-contributors#emoji-key
