# Mera — concept site

A self-initiated Sefer Studio project (`docs/work-artefacts-plan.md` in the `SeferStudio` repo,
§2/§4.02/§6.1; `docs/decisions.md` ADR-1 and ADR-2). Mera is a fictional hydraulic-components
manufacturer selling into the Gulf. This repo is the concept site itself — the studio's own proof
of a bilingual, animated, 2026-trending build — deployed to `mera.seferstudio.com`.

**This repo does not inherit `SeferStudio/CLAUDE.md`.** No four-locale rule, no shared token set,
no shared type system. Two locales only: `en` (default, `/`) and `ar` (`/ar/`, `dir="rtl"`). Its
own visual identity — steel, brass, alabaster; IBM Plex Sans + IBM Plex Sans Arabic — chosen because
a hydraulic manufacturer should look nothing like a creative studio.

## What still binds (ADR-2)

D5, unchanged: no invented client beyond "Mera," no invented results, metrics, certifications,
pressures or tolerances. Geometry, material and craft are free; a number that asserts a fact is
not. This is what the deleted `CaseStudy.astro` chrome got wrong (ISO 22000, a ±0.005mm tolerance)
and the reason not to reintroduce it here.

D19, unchanged: no AI-generated or machine-translated Arabic, ever, on any string — including short
UI chrome like nav labels, not just body copy. Real Arabic comes from Sam, moved file-to-file,
never retyped through a terminal, verified byte-for-byte plus codepoint hygiene plus a real-browser
RTL read before it ships. Until then every Arabic string is an explicit `[pending]` placeholder,
never a plausible-looking stand-in.

## The build (ADR-2, plan §6.1)

Ambitious and animated is the requirement; a restrained static page is the failure mode. The
ambition is spent where it costs nothing on a slow connection, because Mera's own copy claims the
studio builds sites that load fast on Gulf mobile — a heavy build would contradict its own case
study. So: native CSS scroll-driven animation, the View Transitions API, `@property`, anchor
positioning. Any WebGL or JS engine is desktop-gated with a *measured* mobile fallback, proposed
with its cost before it lands, never shipped silently.

**Signature moment:** pressing AR mirrors the layout in front of the reader — nav crossing, columns
swapping, type reflowing RTL, the Arabic face swapping in — as one choreographed transition, not a
page reload. Two real documents (`/` and `/ar/`, crawlable, work without JS) wired with Astro's
built-in `<ClientRouter />` (`astro:transitions` — core Astro, not a UI framework, not a `client:*`
directive) so the browser runs the swap through the native View Transitions API. Matching elements
across both documents share a `transition:name` so the browser interpolates their own geometry
between the EN and mirrored-AR layout — the effect is mostly free once the two documents' DOM
structures actually correspond, because both were already built in logical properties. Reduced
motion gets an instant swap, not a slower one.

Supporting: an exploded-view hydraulic coupling driven by a `view()` timeline; a pointer-tracked
specular highlight on the machined part (CSS custom properties, one damped listener); transitions
between whatever small number of routes this site ends up with.

## Gate

Lighthouse solo runs, mobile, same discipline as the parent studio site: ≥95 is the target, `TBT 0`
where the build is native-CSS-only, and any runtime dependency (WebGL, a JS animation engine)
arrives with measured gzip size, measured LCP delta, and a concrete mobile fallback before it's
proposed, not after it's built.

## Where things live

`SeferStudio/docs/work-artefacts-plan.md` §6.1 — the motion spec this repo builds against.
`SeferStudio/docs/decisions.md` — ADR-1 (this repo's existence) and ADR-2 (the ambition mandate).
`SeferStudio/scripts/composite-mera-m1.mjs` and `measure-screen-quad.mjs` — the one thing that
crosses the repo boundary, warping this site's own screenshots onto the M1 desk photograph.
