# React Bits components

- GlowCursor (JavaScript + CSS): installed with `npx shadcn@latest add @react-bits/GlowCursor-JS-CSS --yes`, from https://reactbits.dev/r/GlowCursor-JS-CSS.json. The registry lists no additional dependencies.
- FoldText (JavaScript + CSS): exact component and CSS supplied in the project chat. Requires GSAP.
- Orb (JavaScript + CSS): exact WebGL2 component and CSS supplied in the project chat.

React and React DOM provide the component runtime. Integrations and responsive styles live outside
these source files, in `src/main.jsx`, `src/orbBridge.jsx`, and `css/design.css`.

Source library: https://reactbits.dev — https://github.com/DavidHDev/react-bits

## Editorial layout additions

SplitText, Magnet, Dock, SpotlightCard, CountUp, StarBorder, CurvedLoop, and StaggeredMenu
were supplied as JavaScript component sources in the project chat. Their source and supplied
CSS are preserved here, with integration adaptations in StaggeredMenu (keyboard dismissal,
focus trapping, inert closed links, close on navigation, and reduced-motion transitions) and
Dock (pressed state for the active section). The word split uses integration CSS to restore
spacing between its adjacent word blocks.

Dependencies added: `@gsap/react`, `motion`, `@fontsource/instrument-serif`, and
`@fontsource-variable/dm-sans`. Fonts are bundled locally. `Navigation.jsx` provides the
bottom dock; `enhancements.jsx` preserves the existing DOM controls while wrapping
them with Magnet, StarBorder, and SpotlightCard, and renders CountUp KPI values.

Each view has at most one visible StarBorder action. Magnet and cursor effects respect
pointer and reduced-motion preferences. The curved loop and KPI sources also handle reduced motion.

## Functional control primitives

VoicePill, WakeSlider, StatusMark, SwipeRow, SwipeToast, and SquishSwitch were supplied
as JavaScript + CSS sources in the project chat. The attachment titled `undefined` exports
VoicePill. Dependencies added: `@hugeicons/react` and `@hugeicons/core-free-icons`.

`src/widgets.jsx` connects the primitives to the application:
- VoicePill records via the existing audio pipeline. The source has an `external` reactive
  mode and `getLevel` callback so its waveform uses the same microphone as the Orb and
  MediaRecorder. Async recording startup failures stop the pill; blur also stops a latched
  recording. Cancellation, navigation, and unmount discard audio instead of sending it.
- WakeSlider sets HTML audio playback rate (0.60x to 1.25x). SquishSwitch controls automatic
  tutor playback. Preferences persist in localStorage through `js/preferences.js`.
- StatusMark reflects real conversation states and asynchronous work.
- SwipeRow removes generated cards through the existing API. A failed deletion restores the
  collapsed row; a visible Remove button provides a direct alternative to swiping.
- SwipeToast reports session completion, saved reviews, removals, and errors. Error toasts
  remain until dismissed; no unsupported Undo operation is advertised.

These primitives manage their own gestures and are excluded from generic Magnet wrappers.
The microphone lifecycle and playback-rate behavior are checked with `npm test` using fake
browser audio interfaces; live microphone/AI verification still requires permission and backend credentials.

## Minimal entry screen

The landing screen uses a viewport-wide CurvedLoop with one Start action. Language, topic,
choices are collapsed under Settings; audio preferences appear only during a conversation.
Onboarding initially asks only for a name;
language and goal fields remain available under Learning preferences. The Orb is mounted
only in the live conversation view. StaggeredMenu is no longer rendered; navigation uses
an idle compact Dock that expands on hover/focus, or on the first touch (the next touch
selects a destination), and shrinks again after touch inactivity.

## GlideSelect and Scanner

GlideSelect and Scanner use the JavaScript + CSS sources supplied in the project chat.
`src/selection.jsx` preserves the shared selection API while rendering GlideSelect for
conversation languages/topics, review/progress language filters, and onboarding. Hidden
native onboarding selects retain their form names and submitted values. New dependencies
were unnecessary because Hugeicons is already installed.

Scanner is mounted once as a low-intensity, non-interactive background, with a gradient
fallback when WebGL is unavailable. The palette uses deep teal, sage, and warm peach.
The Dock has larger icons and persistent labels instead of a small caption underneath.

VoicePill has a `centered` integration prop: its wrapper reserves the full visible capsule
width during expansion, while its microphone button remains anchored to the wrapper's right.
The wrapper is centered in the controls row, keeping waveform, timer, and button aligned as
one object. The existing external audio source integration is unchanged.

Production builds update the JS/CSS query versions in `index.html` using content hashes,
so the static FastAPI host does not combine a new document with stale browser assets.

For a visual alignment check without microphone permission, run the Vite development server
and open `/tests/fixtures/voice-pill.html`. The fixture uses simulated input with the same
centered capsule size and control-row CSS. Expanded-capsule center offset was checked at
desktop and 390px phone widths: 0px in both cases.

## Disclosure and heading fixes

`src/disclosureMotion.js` animates native details/summary panels in both directions, supports
interrupted toggles, preserves keyboard interaction, and respects reduced-motion preferences.
SplitText now clips only when its mask option is explicitly enabled; normal page headings
allow serif descenders to extend past their line box. The progress mistake rows omit the
count/session pills while preserving the underlying API data.

The Orb uses a black shader reference background and premultiplied alpha output so the
canvas remains transparent over Scanner. Its shader output and the VoicePill, SplitText,
and Dock integration adaptations described above differ from the supplied sources.
