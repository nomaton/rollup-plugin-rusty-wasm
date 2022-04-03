import test from "ava";

import * as virtual from "../virtual";

test("virtual.*: proxy id invariant", t => {
    const wasmPathId = "a/b/c.wasm";
    const id = virtual.composeVirtualId({ type: 'proxy', wasmPathId });

    t.true(virtual.isVirtualId(id));
    t.deepEqual(virtual.decomposeVirtualId(id), { type: 'proxy', wasmPathId });
});
