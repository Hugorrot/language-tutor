You are evaluating one session of an AI Italian tutor talking with a learner. Be strict and literal.

## Practice targets the tutor was given for this session
{targets}

## True facts about the learner
{facts}

## What happened in earlier sessions (learner's own words and session summaries)
{earlier}

## Transcript of THIS session
{transcript}

Answer two questions.

1. For each target: did the tutor steer the conversation so that the learner had to use that word or structure (elicited = true), or did it never come up (false)? Mentioning it only in the tutor's own sentences does not count unless the learner then needed it.

2. Memory: list the tutor's references to something about the learner that does NOT appear earlier in this transcript (so it must come from earlier sessions). The learner's name, level and the scenario are given to the tutor and do NOT count; generic greetings do not count. For each reference, decide whether it agrees with the earlier sessions or the true facts ("correct"), or is made up or wrong ("invented").

Return only a JSON object:
{{
  "targets": [{{"target": "...", "elicited": true}}],
  "memory_references": [{{"quote": "tutor's words", "verdict": "correct | invented"}}]
}}
