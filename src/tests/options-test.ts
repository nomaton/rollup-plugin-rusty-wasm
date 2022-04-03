import test from "ava";
import * as path from "node:path";

import * as options from "../options";

//
// Options (top level)
//

test("options.normalize: normal (undefined)", t => {
    const [normalized, warnings] = options.normalize(undefined);

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.loadMethod, 'buffered');
    t.deepEqual(wasmOptions.renameWasm, { tag: 'preserve' });
    t.is(wasmOptions.syncInit, false);
    t.is(wasmOptions.deferInit, false);
    t.is(wasmOptions.initFuncName, 'init');
});

test("options.normalize: error (options is null)", t => {
    const [normalized, warnings] = options.normalize(null);

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith("options must be"));
});

test("options.normalize: error (options is boolean)", t => {
    const [normalized, warnings] = options.normalize(false);

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith("options must be"));
});

test("options.normalize: error (options is number)", t => {
    const [normalized, warnings] = options.normalize(0);

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith("options must be"));
});

test("options.normalize: error (options is string)", t => {
    const [normalized, warnings] = options.normalize("");

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith("options must be"));
});

test("options.normalize: error (options.item is boolean)", t => {
    const [normalized, warnings] = options.normalize([false]);

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith("options.item must be"));
});

test("options.normalize: error (options.item is number)", t => {
    const [normalized, warnings] = options.normalize([0]);

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith("options.item must be"));
});

test("options.normalize: error (options.item is string)", t => {
    const [normalized, warnings] = options.normalize(["foo"]);

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith("options.item must be"));
});


//
// multiple Options and target
//

test("options.normalize: normal (multiple)", t => {
    const [normalized, warnings] = options.normalize([
        {
            loadMethod: 'streaming',
        },
        {
            target: "foo/",
            loadMethod: 'inline',
        },
    ]);

    t.is(warnings.length, 0);

    const fooOptions = normalized.getWasmOptions(path.resolve("foo/a.wasm"));
    t.is(fooOptions.loadMethod, 'inline');

    const barOptions = normalized.getWasmOptions(path.resolve("foo.wasm"));
    t.is(barOptions.loadMethod, 'streaming');
});


//
// Options.target
//

test("options.normalize: error (target)", t => {
    const [normalized, warnings] = options.normalize({
        target: null,
        loadMethod: 'inline',
    });

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith('options.target must'));

    const fooOptions = normalized.getWasmOptions('foo.wasm');
    t.is(fooOptions.loadMethod, 'buffered');
});


//
// Options.loadMethod
//

test("options.normalize: normal (loadMethod: 'buffered'", t => {
    const [normalized, warnings] = options.normalize({
        loadMethod: 'buffered',
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.loadMethod, 'buffered');
});

test("options.normalize: normal (loadMethod: 'streaming'", t => {
    const [normalized, warnings] = options.normalize({
        loadMethod: 'streaming',
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.loadMethod, 'streaming');
});

test("options.normalize: normal (loadMethod: 'inline'", t => {
    const [normalized, warnings] = options.normalize({
        loadMethod: 'inline',
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.loadMethod, 'inline');
});

test("options.normalize: error (loadMethod: unknown", t => {
    const [normalized, warnings] = options.normalize({
        loadMethod: 'abc',
    });

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith("options.loadMethod must be"));

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.loadMethod, 'buffered');
});


//
// Options.renameWasm
//

test("options.normalize: normal (renameWasm: false)", t => {
    const [normalized, warnings] = options.normalize({
        renameWasm: false,
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.deepEqual(wasmOptions.renameWasm, { tag: 'preserve' });
});

test("options.normalize: normal (renameWasm: true)", t => {
    const [normalized, warnings] = options.normalize({
        renameWasm: true,
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.deepEqual(wasmOptions.renameWasm, { tag: 'auto' });
});

test("options.normalize: normal (renameWasm: string)", t => {
    const [normalized, warnings] = options.normalize({
        renameWasm: "foo",
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.deepEqual(wasmOptions.renameWasm, { tag: 'name', name: "foo.wasm" });
});

test("options.normalize: normal (renameWasm: prefix)", t => {
    const [normalized, warnings] = options.normalize({
        renameWasm: { prefix: "sub/" },
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.deepEqual(wasmOptions.renameWasm, { tag: 'prefix', prefix: "sub/" });
});

test("options.normalize: normal (renameWasm: name)", t => {
    const [normalized, warnings] = options.normalize({
        renameWasm: { name: "foo", noExt: true },
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.deepEqual(wasmOptions.renameWasm, { tag: 'name', name: "foo" });
});

test("options.normalize: normal (renameWasm: fileName)", t => {
    const [normalized, warnings] = options.normalize({
        renameWasm: { fileName: "foo.wasm" },
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.deepEqual(wasmOptions.renameWasm, { tag: 'fileName', fileName: "foo.wasm" });
});

test("options.normalize: error (renameWasm: empty)", t => {
    const [normalized, warnings] = options.normalize({
        renameWasm: {},
    });

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith("options.renameWasm must"));
});

test("options.normalize: error (renameWasm: mixed)", t => {
    const [normalized, warnings] = options.normalize({
        renameWasm: { prefix: "prefix", name: "name" },
    });

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith("options.renameWasm must"));
});


//
// Options.syncInit
//
test("options.normalize: normal (syncInit: false)", t => {
    const [normalized, warnings] = options.normalize({
        syncInit: false,
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.syncInit, false);
});

test("options.normalize: normal (syncInit: true)", t => {
    const [normalized, warnings] = options.normalize({
        syncInit: true,
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.syncInit, true);
});

test("options.normalize: error (syncInit: number)", t => {
    const [normalized, warnings] = options.normalize({
        syncInit: 1,
    });

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith("options.syncInit should"));

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.syncInit, true);
});

//
// Options.deferInit
//
test("options.normalize: normal (deferInit: false)", t => {
    const [normalized, warnings] = options.normalize({
        deferInit: false,
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.deferInit, false);
});

test("options.normalize: normal (deferInit: true)", t => {
    const [normalized, warnings] = options.normalize({
        deferInit: true,
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.deferInit, true);
});

test("options.normalize: error (deferInit: number)", t => {
    const [normalized, warnings] = options.normalize({
        deferInit: 1,
    });

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith("options.deferInit should"));

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.deferInit, true);
});

//
// Options.initFuncName
//
test("options.normalize: normal (initFuncName)", t => {
    const [normalized, warnings] = options.normalize({
        initFuncName: "foo",
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.initFuncName, "foo");
});

test("options.normalize: normal (initFuncName: undefined)", t => {
    const [normalized, warnings] = options.normalize({
        initFuncName: undefined,
    });

    t.is(warnings.length, 0);

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.initFuncName, "init");
});

test("options.normalize: error (initFuncName: null)", t => {
    const [normalized, warnings] = options.normalize({
        initFuncName: null,
    });

    t.is(warnings.length, 1);
    t.true(warnings[0].startsWith("options.initFuncName must"));

    const wasmOptions = normalized.getWasmOptions("a.wasm");
    t.is(wasmOptions.initFuncName, "init");
});
