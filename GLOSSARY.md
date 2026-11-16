# Esqia

Edit Markdown and MDX from the rendered page.

## Language

**Run**:
A stretch of neighbouring text blocks edited together in one editor, in place of their rendered form. A code block is always a run of its own.
_Avoid_: Editor session, selection

**Open edit**:
The one run open at a time. It is settled before anything else writes to a file, and it can refuse, which stops what was waiting on it.
_Avoid_: Active editor, current session
