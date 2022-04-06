# Game-of-Life simulator with `rollup-plugin-rusty-wasm` and `wasm-pack`

Simple Conway's Game of Life simulator on the browser. 
Many parts of the code is borrowed from a tutorial of [Rust and WebAssembly](https://rustwasm.github.io/docs/book/introduction.html) (where [Webpack](https://webpack.js.org/) is used as a bundler instead of Rollup.)

The `wasm-pack` output used by this example is already put in the `pkg` directory, so that just running this example has no need to set up the **wasm-pack** or Rust related tools.  You can reproduce the output by running
```sh
$ wasm-pack build --target bundler
```
in the top directory.
Note that some files (generated `.gitignore` and copied `README.md`) are removed for Github registration.


## How to Run

1. Install dependencies

```sh
$ npm install
```

2. Run one of

```sh
$ npm run start-iife
$ npm run start-esm
$ npm run start-inline
```

Every command works similarly in the different manner (see below):
it makes a bundled output and starts a test server.

3. Access http://localhost:8080.

If everything goes well, the living life-game will be displayed.


## Example Types

This example has three kinds of rollup configuration which share
the same `wasm-pack` output in the `pkg` directory.

### IIFE (Immediately Invoked Function Expression)

`npm run start-iife` uses the config `rollup-iife.config.js`:

```
input:          web-iife/index.js
output.dir:     dist-iife
output.format:  iife
plugin options: empty (default)
```

In this case, wasm exports can be accessed only after the init function resolved (see `web-iife/index.js`.)

### ES Module

`npm run start-esm` uses the config `rollup-esm.config.js`:

```
input:          web-esm/index.js
output.dir:     dist-esm
output.format:  esm (or es, module)
plugin options:
    syncInit:       true
    loadMethod:     streaming
```

In this case, wasm exports can be accessed directly (see `web-esm/index.js`)
while the `<script>` tag has to set `type="module"` (see `web-esm/index.html`.)

### ES Module (inline)

`npm run start-inline` uses the config `rollup-inline.config.js`:

```
input:          web-esm/index.js (shared with the previous one)
output.dir:     dist-inline
output.format:  esm (or es, module)
plugin options:
    syncInit:       true
    loadMethod:     inline
```

This example is very similar to the previous one but the wasm file is inlined instead of copied.
See the output `dist-inline` doesn't contains the wasm file
and `dist-inline/index.js` has an embedded magic string.
