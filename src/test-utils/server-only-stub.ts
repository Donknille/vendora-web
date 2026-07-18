// Empty stand-in for the `server-only` package in the Vitest (node) environment.
// The real package throws unless the bundler sets the `react-server` condition,
// which Vitest does not; aliasing it here lets tests import server modules.
export {};
