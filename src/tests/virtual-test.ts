import test from "ava";

import * as virtual from "../virtual";

test("virtual.*: proxy id invariant", t => {
    const wasmId = "a/b/c.wasm";
    const id = virtual.composeVirtualId({ type: 'proxy', wasmId });

    t.true(virtual.isVirtualId(id));
    t.deepEqual(virtual.decomposeVirtualId(id), { type: 'proxy', wasmId });
});
