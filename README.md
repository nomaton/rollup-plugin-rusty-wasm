# rollup-plugin-rusty-wasm


## Description

This is a rollup plugin to bundle the wasm file.
This plugin is primarily developped for dealing with the Rust wasm-pack output files.

## Usages

TODO: how to install

```js
// rollup.config.js
import rustywasm from "rollup-plugin-rusty-wasm";

export default {
    input: "src/index.js",
    output: {
        dir: "dist",
    },
    plugins: [
        rustyWasm(),
    ],
}
```

This plugin assumes wasm files to have correct module paths in the inport records.

When you use the output of `wasm-pack` or `wasm-bindgen`,
`--target` must be set `bundler` (default) and
the contents of the output directory (`*.wasm` and `*.js`) be preserved.


## Options

**type**: one of
- `undefined` (ommited)
- `OptionItem (object)`
- `[OptionItem (object)]`

This plugin takes options of type **OptionItem** (described below)
or an array of them.

Each item has an optional target predicate (file-path based)
to determine whether to apply the options to each wasm file.
If the target predicate is not set, the options of the item is always applied.
If multiple items are applied, the following items overwrite the same fields of the preceding items.

```js
// single item
plugins: [
    rustyWasm({
        // OptionItem fields
        loadMethod: 'inline',
    }),
]

// multiple items
plugins: [
    rustyWasm([
        {
            target: undefined, // may be omitted
            // applied to all the wasm.
            loadMethod: 'streaming',
        },
        {
            target: "foo/",
            // only applied to the wasm under './foo' directory.
            // overwrites the same fields preceding.
            loadMethod: 'inline',
        }
    ]),
]
```

Normally the single item without the target predicate is sufficient
unless you have multiple wasm files to be handled differently.

If there is no options or no predicates are satisfied, it uses the default values.

```js
// default values
{
    loadMethod: 'buffered',
    renameWasm: false,
    syncInit: false,
    deferInit: false,
    initFuncName: 'init',
}
```

### `OptionItem` object

`OptionItem` is an object with the following fields:

- `target` (optional)
- `loadMethod` (optional)
- `renameWasm` (optional)
- `syncInit` (optional)
- `deferInit` (optional)
- `initFuncName` (optional)


### `OptionItem.target`

**type**: `string`

Specifies the prefix of wasm file path to apply this `OptionItem`.
If omitted, it is always applied.

For more description, see the section: Options Target.


### `OptionItem.loadMethod`

**type**: `'buffered'` | `'streaming'` | `'inline'`

**default**: `'buffered'`

Specifies how to load the wasm file.

If set `'buffered'`, wasm files are loaded by `fetch()` [[mdn](https://developer.mozilla.org/en-US/docs/Web/API/fetch)] then compiled by `WebAssembly.compile()` [[mdn](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/compile)].

If set `'streaming'`, wasm files are loaded and compiled by `WebAssembly.compileStreaming()` [[mdn](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/compileStreaming)].

Note that while `'streaming'` is more desirable than `'buffered'` for efficiency, `streaming` requires the server to emit wasm files with the mime-type `application/wasm` (some test servers will fail).

If set `inline`, wasm files are embedded in the bundle file as strings encoded by the *uuencode* variant (a cousin of the Base64 encoding).


### `OptionItem.renameWasm`

**type**: `boolean` | `string` | `object`

**default**: `false`

Specifies how to name the output wasm file.
This option is ignored if `loadMethod` is set `'inline'`.

If set `false` (default), the original file name is preserved and output directly under the `output.dir`.

If set `true`, the file name is determined by the rollup default rule.

If set a `string` value *name*, the file name is determined using `output.assetFileNames`[[rollup.js](https://www.rollupjs.org/guide/en/#outputassetfilenames)] settings. If *name* has no extension, `.wasm` is appended.

For more description, see the section: Output wasm Name.


### `OptionItem.syncInit`

**type**: `boolean`

**default**: `false`

If set `true`, the wasm module is initialized synchronically in the wasm import.
This setting is available only if the rollup `output.format` supports the **top level await**.

For more description, see the section: Initialization.


### `OptionItem.deferInit`

**type**: `boolean`

**default**: `false`

If set `true`, the initialization is defered until the init function is called.

For more description, see the section: Initialization.


### `OptionItem.initFuncName`

**type**: `string`

**default**: `'init'`

Specifies the name of the ad-hoc exported function to initialize the wasm module.

For more description, see the section: Initialization.


## Initialization

By default, this plugin adds an ad-hoc exported function `init` to each wasm module.
This function initializes the wasm module and returns a promise
which certifies that the wasm exports are available.

```js
import { init, someFunc } from "./foo.wasm";

someFunc(); // Error (may not be available)

init().then(() => {
    someFunc();  // OK
});
```

If `optionItem.syncInit` is set true, the initialization is completed within the wasm import
so that the exports are available as soon as imported.

```js
// syncInit: true
import { someFunc } from "./foo.wasm";

someFunc(); // OK
```

This setting is available only if the rollup 
`output.format`[[rollup.js](https://www.rollupjs.org/guide/en/#outputformat)]
supports the **top level await** (`es` or `system`).

In this case, the ad-hoc function `init` is not exported.


If `optionItem.deferInit` is set true, it defers the initialization and creating the promise
until the first call of `init`.
Otherwise (default), the initialization starts and the promise is created when the wasm is imported,
and `init` just returns the created promise.

The name of ad-hoc function `init` can be changed by setting `optionItem.initFuncName`.
This is useful when the wasm itself has an export of name `init`.

```js
// initFuncName: "initWasm"
import { initWasm, init } from "./foo.wasm";

initWasm().then(() => {
    init();  // exported by foo.wasm itself
});
```

`deferInit` and `initFuncName` are ignored when `syncInit` is `true`.


## Output wasm Name

By default, the names of the output wasm files are identical to the input files
and put just under the directory set at rollup `output.dir`.

This behavior can be changed by setting `OptionItem.renameWasm`, which takes the following values:

- `false` (default)
- `true`
- *name*`: string`
- `{ prefix: string }`
- `{ name: string, noExt?: boolean }`
- `{ fileName: string }`

If set `true`, the file name is determined by the rollup default rule.

If set a `string` value *name*, the file name is determined using `output.assetFileNames`[[rollup.js](https://www.rollupjs.org/guide/en/#outputassetfilenames)] settings. If *name* has no extension, `.wasm` is appended.
Note that the extension is preserved in the default `output.assetFileNames` pattern.

If set an object of `{prefix: `*prefix*`}`, the *prefix* is prepended to the original file name.
*prefix* may contain path separators to put the wasm files under the subdirectory of `output.dir`.

If set an object of `{name: `*name*`}`, it behaves the same way as setting a `string` value *name*.
Setting the optional field `noExt: true` prevents complementing the extension `.wasm`.

If set `{fileName: `*fileName*`}`, *fileName* is used as the output wasm path under the `output.dir`.
Note that applying this setting to multiple wasm files causes the file name collision error.

```js
// examples
// - input wasm file:   original.wasm
// - output.dir:        dist
renameWasm: false,                          // --> dist/original.wasm
renameWasm: true,                           // --> dist/assets/{hash} (*)
renameWasm: "foo",                          // --> dist/assets/foo-{hash}.wasm (*)
renameWasm: { prefix: "sub/" },             // --> dist/sub/original.wasm
renameWasm: { name: "foo" },                // --> dist/assets/foo-{hash}.wasm (*)
renameWasm: { name: "foo", noExt: true },   // --> dist/assets/foo-{hash} (*)
renameWasm: { name: "foo.wasm2" },          // --> dist/assets/foo-{hash}.wasm2 (*)
renameWasm: { fileName: "sub/bar.wasm" },   // --> dist/sub/bar.wasm
// (*) ... use default rollup settings
```

## Options Target

Each option item has an optional `target` field, which specifies the path
of wasm file to which apply the options.
The `target` is considered as a prefix of the target wasm file path
and corrected to the absolute path before matching
(the non-absolute path is resolved from the current directory).

If `target` ends with suffix `'/'` (no backslash `'\\'`),
it is considered as a directory and
matches only the contents including subdirectories.
Otherwise, any path starting with (or equal to) the prefix matches.

For example, `"foo"` will match
- `./foo.wasm`,
- `./foo/bar.wasm`
- `./foo-bar/baz.wasm`

while `"foo/"` will match only
- `./foo/bar.wasm`

If `target` field is absent, the option item is applied always.
This is useful for the common settings, but it must be put at the begenning
of the options array as the preceding items are overwritten.

## License

MIT