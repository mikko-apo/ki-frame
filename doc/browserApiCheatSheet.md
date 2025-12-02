Here are notes on browser and DOM technical details

<!-- TOC -->

* [Form](#form)
    * [Form related DOM nodes](#form-related-dom-nodes)
    * [Best events for form controls](#best-events-for-form-controls)
* [Other browser events and ways browser can trigger actions](#other-browser-events-and-ways-browser-can-trigger-actions)
    * [Browser initiated DOM events](#browser-initiated-dom-events)
    * [User initiated DOM events](#user-initiated-dom-events)
    * [Callback-based triggering](#callback-based-triggering)
* [Technical browser details](#technical-browser-details)
    * [WeakRef](#weakref)
    * [Avoid: Top level const/let and window.state](#avoid-top-level-constlet-and-windowstate)

<!-- TOC -->

# Form

## Form related DOM nodes

- Container
    - `form`
- Inputs / output
    - `input`
        - Textual input types: `text`, `search`, `tel`, `url`, `email`, `password`
        - Numeric input types: `number`, `range`
        - Date & time input types: `date`, `month`, `week`, `time`, `datetime-local` (note: `datetime` is obsolete)
        - Choice & state input types: `checkbox`, `radio`
        - Buttons: `button`, `submit`, `reset`, `image`
        - File upload: `file`
        - Color: `color`
        - Hidden: `hidden`
    - `textarea`
    - `select`
        - `optgroup`
        - `option`
    - `output`
- Buttons
    - `button`
    - `input type="submit/reset/button"`
- Structure
    - `fieldset`
    - `legend`
- Helpers
    - `label`
    - `datalist`
        - `option`
- Form-associated (even outside form)
    - `meter`, `progress`, `object`
    - `input`, `button`, `select`, `textarea`, `label`, `fieldset`, `output`

## Best events for form controls

- Text `<input type="text|search|email|tel|url|password">`, `<textarea>`
    - Best: `input` (live), `change` (final), `blur` (validate on leave), `keydown` / `keyup` (special key handling),
      `compositionstart` / `compositionend` (IME handling)
- Number `<input type="number">`
    - Best: `input` (live numeric parsing), `change` (final), `blur` (format/validate)
- Range `<input type="range">`
    - Best: `input` (live slider position), `change` (final value when thumb released)
- Checkbox / Radio (`<input type="checkbox|radio">`)
    - Best: `change` (fires immediately when toggled), `click` (if you need original mouse/touch event)
- Select `<select>`
    - Best: `change` (user committed new selection). For multi-select check on `change` too.
- File `<input type="file">`
    - Best: `change` (files list is available after selection). Also focus/blur for UX.
- Buttons (`<button>` or `<input type="submit|reset|button|image">`)
    - Best: `click` (handle custom behavior), `submit` on the surrounding `<form>` for form submit flow.
- Form `<form>`
    - Best: `submit` (catch and preventDefault() for custom submit), `reset` (when form is reset), `invalid` (listen on
      elements via capture), `input` (if you want any change inside the form).
- Contenteditable elements
    - Best: `input` and `beforeinput` (richer control of DOM mutations), `paste` (handle pasted content), composition
      events for IME.
- All text-like inputs (for IME / composition)
    - `compositionstart` / `compositionupdate` / `compositionend` — essential when you need accurate input while users
      are using IME (CJK) so you don’t treat intermediate composition text as final.
- Output / Meter / Progress
    - Usually read-only; `change`/`input` generally not needed. Observe programmatic updates.

# Other browser events and ways browser can trigger actions

## Browser initiated DOM events

* DOM & page lifecycle events
    * DOMContentLoaded
    * load
    * beforeunload / unload
    * pageshow / pagehide
    * visibilitychange
    * readystatechange
* Window/environment events
    * resize
    * scroll
    * hashchange
    * popstate
    * online / offline
    * storage
* Resource loading events
    * &lt;img>: load, error
    * &lt;script>: load, error
    * &lt;link> (CSS): load, error
    * XMLHttpRequest: load, error, timeout, abort
* CSS animation & transition events
    * animationstart / animationend
    * animationiteration
    * transitionend
* Web messaging events
    * message (postMessage between windows or workers)
    * error

## User initiated DOM events

* Mouse events
    * click / dblclick / auxclick
    * mousedown / mousemove / mouseup
    * mouseenter / mouseleave
    * mouseover / mouseout
    * contextmenu
    * wheel
* Pointer events
    * pointerdown / pointermove / pointerup
    * pointerenter / pointerleave
    * pointerover / pointerout
    * pointercancel
    * gotpointercapture / lostpointercapture
* Touch events
    * touchstart / touchmove / touchend
    * touchcancel
* Drag and drop events
    * dragstart
    * drag
    * dragend
    * dragenter
    * dragleave
    * dragover
    * drop
* Keyboard events
    * keydown / keyup
    * keypress (deprecated)
* Focus events
    * focus, blur, focusin, focusout
* Clipboard events
    * copy
    * cut
    * paste
* Media events
    * play, pause, ended, canplay, timeupdate
* Device and fullscreen events
    * deviceorientation, devicemotion
    * fullscreenchange, fullscreenerror

## Callback-based triggering

* Promises/microtasks (internal scheduling)
    * Promise resolution callbacks (then, catch, finally)
    * window.queueMicrotask()
* Streams, fetch progression, async iterators
* Timers
    * setTimeout(fn)
    * setInterval(fn)
* Rendering & idle scheduling
    * requestAnimationFrame(fn)
    * requestIdleCallback(fn)
* Observers observe a number of targets and call a callback function
    * MutationObserver - Callback runs when DOM changes.
    * ResizeObserver - Callback runs when element size changes.
    * IntersectionObserver - Callback runs when element intersects viewport.
* WebRTC callbacks
    * CE candidate callbacks
    * PeerConnection state callbacks

# Technical browser details

## WeakRef

Desktop browsers have supported WeakRef since 2020-2021, mobile browsers 2024-2025.
