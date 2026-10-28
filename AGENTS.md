<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read `antislop.md` (core) and then the skill for the task:
- Core filter, always on: `.reference/system/agents/skills/antislop/SKILL.md` (or `skills/antislop/SKILL.md`)
- UI / visual: `.reference/system/agents/skills/antislop-ui/SKILL.md` (or `skills/antislop-ui/SKILL.md`)
- Copy & text: `.reference/system/agents/skills/antislop-copywriting/SKILL.md` (or `skills/antislop-copywriting/SKILL.md`)
- People / Accessibility: `.reference/system/agents/skills/antislop-human/SKILL.md` (or `skills/antislop-human/SKILL.md`)
- Mobile / responsive: `.reference/system/agents/skills/antislop-layoutmobile/SKILL.md` (or `skills/antislop-layoutmobile/SKILL.md`)
- Code comments: `.reference/system/agents/skills/antislop-code/SKILL.md` (or `skills/antislop-code/SKILL.md`)
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: run `portal update` or `portal antislop update`.
<!-- antislop:end -->
