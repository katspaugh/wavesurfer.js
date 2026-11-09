// Registered through `setupFiles` in jest.config.js, so it runs once per test file before any
// suite code.
//
// jsdom ships HTMLMediaElement.prototype.pause/load as "not implemented" stubs that report
// through its virtual console: every call prints a multi-line `console.error` ("Error: Not
// implemented: HTMLMediaElement.prototype.pause"). Player.destroy() calls both on the <audio>
// element it owns, so nearly every suite that creates and destroys a WaveSurfer/Player instance
// printed two such blocks -- about a hundred per run, burying any real warning a test emits.
//
// Replacing them with silent no-ops changes no behavior the suites rely on (the jsdom versions
// do nothing but log). `play` is deliberately left alone: its "not implemented" report is how a
// test notices it reached real playback without mocking it.
HTMLMediaElement.prototype.pause = function pause(): void {}
HTMLMediaElement.prototype.load = function load(): void {}
