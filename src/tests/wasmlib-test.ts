import test from "ava";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import * as wasmlib from "../wasmlib";


test("wasmlib.tryReadU32: normal", t => {
    const buf = Buffer.from([0x01, 0x82, 0x03, 0xff, 0xff, 0xff, 0xff, 0x0f]);
    t.deepEqual(wasmlib.tryReadU32(buf, 0), [0x1, 1]);
    t.deepEqual(wasmlib.tryReadU32(buf, 1), [0x182, 2]);
    t.deepEqual(wasmlib.tryReadU32(buf, 3), [0xffffffff, 5]);
});

test("wasmlib.tryReadU32: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadU32(buf, 0), null);
});

test("wasmlib.tryReadU32: error (incomplete)", t => {
    const buf = Buffer.from([0xff, 0xff, 0xff, 0xff]);
    t.is(wasmlib.tryReadU32(buf, 0), null);
});

test("wasmlib.tryReadU32: error (overflow)", t => {
    const buf = Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff]);
    t.is(wasmlib.tryReadU32(buf, 0), null);
});

test("wasmlib.tryReadName: normal", t => {
    const buf = Buffer.from([0x03, 0x41, 0x42, 0x43, 0x00]);
    t.deepEqual(wasmlib.tryReadName(buf, 0), ["ABC", 4]);
    t.deepEqual(wasmlib.tryReadName(buf, 4), ["", 1]);
});

test("wasmlib.tryReadName: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadName(buf, 0), null);
});

test("wasmlib.tryReadName: error (incomplete)", t => {
    const buf = Buffer.from([0x05, 0x41, 0x42, 0x43, 0x44]);
    t.is(wasmlib.tryReadName(buf, 0), null);
});

test("wasmlib.tryReadName: error (invalid length)", t => {
    const buf = Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0x80]);
    t.is(wasmlib.tryReadName(buf, 0), null);
    t.is(wasmlib.tryReadName(buf, 5), null);
});

test("wasmlib.tryReadRefType: normal", t => {
    const buf = Buffer.from([0x70, 0x6f]);
    t.deepEqual(wasmlib.tryReadRefType(buf, 0), ['funcref', 1]);
    t.deepEqual(wasmlib.tryReadRefType(buf, 1), ['externref', 1]);
});

test("wasmlib.tryReadRefType: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadRefType(buf, 0), null);
});

test("wasmlib.tryReadRefType: error (invalid tag)", t => {
    const buf = Buffer.from([0x7f]);
    t.is(wasmlib.tryReadRefType(buf, 0), null);
});

test("wasmlib.tryReadValType: normal", t => {
    const buf = Buffer.from([0x7f, 0x7e, 0x7d, 0x7c, 0x70, 0x6f]);
    t.deepEqual(wasmlib.tryReadValType(buf, 0), ['i32', 1]);
    t.deepEqual(wasmlib.tryReadValType(buf, 1), ['i64', 1]);
    t.deepEqual(wasmlib.tryReadValType(buf, 2), ['f32', 1]);
    t.deepEqual(wasmlib.tryReadValType(buf, 3), ['f64', 1]);
    t.deepEqual(wasmlib.tryReadValType(buf, 4), ['funcref', 1]);
    t.deepEqual(wasmlib.tryReadValType(buf, 5), ['externref', 1]);
});

test("wasmlib.tryReadValType: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadValType(buf, 0), null);
});

test("wasmlib.tryReadValType: error (invalid tag)", t => {
    const buf = Buffer.from([0x7b]);
    t.is(wasmlib.tryReadValType(buf, 0), null);
});

test("wasmlib.tryReadLimits: normal", t => {
    const buf = Buffer.from([0x00, 0x01, 0x01, 0x02, 0x05]);
    t.deepEqual(wasmlib.tryReadLimits(buf, 0), [{ min: 1, max: undefined }, 2]);
    t.deepEqual(wasmlib.tryReadLimits(buf, 2), [{ min: 2, max: 5 }, 3]);
});

test("wasmlib.tryReadLimits: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadLimits(buf, 0), null);
});

test("wasmlib.tryReadLimits: error (incomplete {min})", t => {
    const buf = Buffer.from([0x00]);
    t.is(wasmlib.tryReadLimits(buf, 0), null);
});

test("wasmlib.tryReadLimits: error (incomplete {min, max})", t => {
    const buf = Buffer.from([0x01, 0x00]);
    t.is(wasmlib.tryReadLimits(buf, 0), null);
});

test("wasmlib.tryReadLimits: error (invalid tag)", t => {
    const buf = Buffer.from([0x02]);
    t.is(wasmlib.tryReadLimits(buf, 0), null);
});

test("wasmlib.tryReadLimits: error (invalid min)", t => {
    const buf = Buffer.from([0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff]);
    t.is(wasmlib.tryReadLimits(buf, 0), null);
    t.is(wasmlib.tryReadLimits(buf, 6), null);
});

test("wasmlib.tryReadLimits: error (invalid max)", t => {
    const buf = Buffer.from([0x01, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff]);
    t.is(wasmlib.tryReadLimits(buf, 0), null);
});

test("wasmlib.tryReadMemType: normal", t => {
    const buf = Buffer.from([0x00, 0x01, 0x01, 0x02, 0x05]);
    t.deepEqual(wasmlib.tryReadMemType(buf, 0), [{ limits: { min: 1, max: undefined } }, 2]);
    t.deepEqual(wasmlib.tryReadMemType(buf, 2), [{ limits: { min: 2, max: 5 } }, 3]);
});

test("wasmlib.tryReadMemType: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadMemType(buf, 0), null);
});

test("wasmlib.tryReadTableType: normal", t => {
    const buf = Buffer.from([0x70, 0x00, 0x01, 0x6f, 0x01, 0x02, 0x83, 0x01]);
    t.deepEqual(wasmlib.tryReadTableType(buf, 0), [{ type: 'funcref', limits: { min: 1, max: undefined } }, 3]);
    t.deepEqual(wasmlib.tryReadTableType(buf, 3), [{ type: 'externref', limits: { min: 2, max: 0x83 } }, 5]);
});

test("wasmlib.tryReadTableType: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadTableType(buf, 0), null);
});

test("wasmlib.tryReadTableType: error (incomplete)", t => {
    const buf = Buffer.from([0x70]);
    t.is(wasmlib.tryReadTableType(buf, 0), null);
});

test("wasmlib.tryReadGlobalType: normal", t => {
    const buf = Buffer.from([0x7f, 0x00, 0x7d, 0x01]);
    t.deepEqual(wasmlib.tryReadGlobalType(buf, 0), [{ type: 'i32', mut: false }, 2]);
    t.deepEqual(wasmlib.tryReadGlobalType(buf, 2), [{ type: 'f32', mut: true }, 2]);
});

test("wasmlib.tryReadGlobalType: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadGlobalType(buf, 0), null);
});

test("wasmlib.tryReadGlobalType: error (invalid valtype)", t => {
    const buf = Buffer.from([0x00]);
    t.is(wasmlib.tryReadGlobalType(buf, 0), null);
});

test("wasmlib.tryReadGlobalType: error (incomplete)", t => {
    const buf = Buffer.from([0x7f]);
    t.is(wasmlib.tryReadGlobalType(buf, 0), null);
});

test("wasmlib.tryReadGlobalType: error (illegal mut tag)", t => {
    const buf = Buffer.from([0x7f, 0x02]);
    t.is(wasmlib.tryReadGlobalType(buf, 0), null);
});

test("wasmlib.tryReadImportDesc: normal", t => {
    let actual: [wasmlib.ImportDesc, number] | null;
    let expected: [wasmlib.ImportDesc, number];

    const buf = Buffer.from([0x00, 0x05, 0x01, 0x70, 0x01, 0x02, 0x08, 0x02, 0x00, 0x03, 0x03, 0x7c, 0x00]);

    actual = wasmlib.tryReadImportDesc(buf, 0);
    expected = [{ tag: 'func', typeIdx: 5 }, 2];
    t.deepEqual(actual, expected);

    actual = wasmlib.tryReadImportDesc(buf, 2);
    expected = [{ tag: 'table', type: 'funcref', limits: { min: 2, max: 8 } }, 5];
    t.deepEqual(actual, expected);

    actual = wasmlib.tryReadImportDesc(buf, 7);
    expected = [{ tag: 'mem', limits: { min: 3, max: undefined } }, 3];
    t.deepEqual(actual, expected);

    actual = wasmlib.tryReadImportDesc(buf, 10);
    expected = [{ tag: 'global', type: 'f64', mut: false }, 3];
});

test("wasmlib.tryReadImportDesc: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadImportDesc(buf, 0), null);
});

test("wasmlib.tryReadImportDesc: error (invalid tag)", t => {
    const buf = Buffer.from([0x04, 0x00]);
    t.is(wasmlib.tryReadImportDesc(buf, 0), null);
});

test("wasmlib.tryReadImportDesc: error (incomplete func)", t => {
    const buf = Buffer.from([0x00]);
    t.is(wasmlib.tryReadImportDesc(buf, 0), null);
});

test("wasmlib.tryReadImportDesc: error (incomplete table)", t => {
    const buf = Buffer.from([0x01]);
    t.is(wasmlib.tryReadImportDesc(buf, 0), null);
});

test("wasmlib.tryReadImportDesc: error (incomplete mem)", t => {
    const buf = Buffer.from([0x02]);
    t.is(wasmlib.tryReadImportDesc(buf, 0), null);
});

test("wasmlib.tryReadImportDesc: error (incomplete global)", t => {
    const buf = Buffer.from([0x03]);
    t.is(wasmlib.tryReadImportDesc(buf, 0), null);
});

test("wasmlib.tryReadImport: normal", t => {
    const buf = Buffer.from([
        0x01, 0x61, // module 'a'
        0x01, 0x62, // name 'b'
        0x03, 0x7f, 0x00, // global i32 const
    ]);
    const actual = wasmlib.tryReadImport(buf, 0);
    const expected: [wasmlib.Import, number] = [
        { module: "a", name: "b", desc: { tag: 'global', type: 'i32', mut: false } },
        7
    ];
    t.deepEqual(actual, expected);
});

test("wasmlib.tryReadImport: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadImport(buf, 0), null);
});

test("wasmlib.tryReadImport: error (incomplete module)", t => {
    const buf = Buffer.from([0x01]);
    t.is(wasmlib.tryReadImport(buf, 0), null);
});

test("wasmlib.tryReadImport: error (incomplete name)", t => {
    const buf = Buffer.from([0x01, 0x61, 0x02, 0x62]);
    t.is(wasmlib.tryReadImport(buf, 0), null);
});

test("wasmlib.tryReadImport: error (incomplete desc)", t => {
    const buf = Buffer.from([0x01, 0x61, 0x01, 0x62, 0x03]);
    t.is(wasmlib.tryReadImport(buf, 0), null);
});

test("wasmlib.tryReadImportSection: normal", t => {
    const buf = Buffer.from([
        0x02, // count
        0x01, 0x61, // module 'a'
        0x01, 0x62, // name 'b'
        0x03, 0x7f, 0x00, // global i32 const
        0x01, 0x63, // module 'c'
        0x01, 0x64, // name 'd'
        0x03, 0x7d, 0x01, // global f32 mut
    ]);
    const actual = wasmlib.tryReadImportSection(buf, 0);
    const expected: [Array<wasmlib.Import>, number] = [
        [
            { module: "a", name: "b", desc: { tag: 'global', type: 'i32', mut: false } },
            { module: "c", name: "d", desc: { tag: 'global', type: 'f32', mut: true } },
        ],
        15
    ];
    t.deepEqual(actual, expected);
});

test("wasmlib.tryReadImportSection: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadImportSection(buf, 0), null);
});

test("wasmlib.tryReadImportSection: error (incomplete)", t => {
    const buf = Buffer.from([
        0x01, // count
    ]);
    t.is(wasmlib.tryReadImportSection(buf, 0), null);
});

test("wasmlib.tryReadExportDesc: normal", t => {
    const buf = Buffer.from([
        0x00, 0x02, // (func 2)
        0x01, 0x03, // (table 3)
        0x02, 0x04, // (mem 4)
        0x03, 0x05, // (global 5)
    ]);

    let actual: [wasmlib.ExportDesc, number] | null;
    let expected: [wasmlib.ExportDesc, number];

    // 1
    actual = wasmlib.tryReadExportDesc(buf, 0);
    expected = [{ tag: 'func', idx: 2 }, 2];
    t.deepEqual(actual, expected);
    // 2
    actual = wasmlib.tryReadExportDesc(buf, 2);
    expected = [{ tag: 'table', idx: 3 }, 2];
    t.deepEqual(actual, expected);
    // 3
    actual = wasmlib.tryReadExportDesc(buf, 4);
    expected = [{ tag: 'mem', idx: 4 }, 4];
    // 4
    actual = wasmlib.tryReadExportDesc(buf, 6);
    expected = [{ tag: 'global', idx: 5 }, 3];
});

test("wasmlib.tryReadExportDesc: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadExportDesc(buf, 0), null);
});

test("wasmlib.tryReadExportDesc: error (invalid tag)", t => {
    const buf = Buffer.from([0x04, 0x00]);
    t.is(wasmlib.tryReadExportDesc(buf, 0), null);
});

test("wasmlib.tryReadExportDesc: error (incomplete func)", t => {
    const buf = Buffer.from([0x00]);
    t.is(wasmlib.tryReadExportDesc(buf, 0), null);
});

test("wasmlib.tryReadExportDesc: error (incomplete table)", t => {
    const buf = Buffer.from([0x01]);
    t.is(wasmlib.tryReadExportDesc(buf, 0), null);
});

test("wasmlib.tryReadExportDesc: error (incomplete mem)", t => {
    const buf = Buffer.from([0x02]);
    t.is(wasmlib.tryReadExportDesc(buf, 0), null);
});

test("wasmlib.tryReadExportDesc: error (incomplete global)", t => {
    const buf = Buffer.from([0x03]);
    t.is(wasmlib.tryReadExportDesc(buf, 0), null);
});

test("wasmlib.tryReadExport: normal", t => {
    const buf = Buffer.from([
        0x02, 0x61, 0x62, // name 'ab'
        0x03, 0x00, // global 0
    ]);
    const actual = wasmlib.tryReadExport(buf, 0);
    const expected: [wasmlib.Export, number] = [
        { name: "ab", desc: { tag: 'global', idx: 0 } },
        5
    ];
    t.deepEqual(actual, expected);
});

test("wasmlib.tryReadExport: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadExport(buf, 0), null);
});

test("wasmlib.tryReadExport: error (incomplete name)", t => {
    const buf = Buffer.from([0x02, 0x61]);
    t.is(wasmlib.tryReadExport(buf, 0), null);
});

test("wasmlib.tryReadExport: error (incomplete desc)", t => {
    const buf = Buffer.from([0x01, 0x61, 0x00]);
    t.is(wasmlib.tryReadExport(buf, 0), null);
});

test("wasmlib.tryReadExportSection: normal", t => {
    const buf = Buffer.from([
        0x03,
        0x01, 0x61, // name "a"
        0x03, 0x00, // (global 0)
        0x01, 0x62, // name "b"
        0x00, 0x01, // (func 1)
        0x01, 0x63, // name "c"
        0x01, 0x02, // (table 2)
    ]);
    const actual = wasmlib.tryReadExportSection(buf, 0);
    const expected: [Array<wasmlib.Export>, number] = [
        [
            { name: "a", desc: { tag: 'global', idx: 0 } },
            { name: "b", desc: { tag: 'func', idx: 1 } },
            { name: "c", desc: { tag: 'table', idx: 2 } },
        ],
        13
    ];
    t.deepEqual(actual, expected);
});

test("wasmlib.tryReadExportSection: error (empty)", t => {
    const buf = Buffer.from([]);
    t.is(wasmlib.tryReadExportSection(buf, 0), null);
});

test("wasmlib.tryReadExportSection: error (incomplete)", t => {
    const buf = Buffer.from([0x01]);
    t.is(wasmlib.tryReadExportSection(buf, 0), null);
});

test("wasmlib.readModule: normal (imports)", async t => {
    const buf = await fs.readFile(path.join(__dirname, "_fixtures", "test001.wasm"));
    const res = wasmlib.readModule(buf);
    if (res.ok) {
        t.pass();
        const module = res.value;

        t.is(module.version, 1);

        const expect: Array<wasmlib.Import> = [
            { module: "m1", name: "a", desc: { tag: 'func', typeIdx: 0 } },
            { module: "m1", name: "b", desc: { tag: 'func', typeIdx: 1 } },
            { module: "m2", name: "a", desc: { tag: 'global', type: 'f32', mut: false } },
        ]
        t.deepEqual(module.imports, expect);

    } else {
        t.fail(res.error);
    }
});

test("wasmlib.readModule: normal (exports)", async t => {
    const buf = await fs.readFile(path.join(__dirname, "_fixtures", "test002.wasm"));
    const res = wasmlib.readModule(buf);
    if (res.ok) {
        t.pass();
        const module = res.value;

        t.is(module.version, 1);

        const expect: Array<wasmlib.Export> = [
            { name: "a", desc: { tag: 'global', idx: 0 } },
            { name: "b", desc: { tag: 'global', idx: 1 } },
        ]
        t.deepEqual(module.exports, expect);

    } else {
        t.fail(res.error);
    }
});

test("wasmlib.readModule: error (empty)", t => {
    const buf = Buffer.from([]);
    const res = wasmlib.readModule(buf);
    t.false(res.ok);
});

test("wasmlib.readModule: error (invalid magic)", t => {
    const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]);
    const res = wasmlib.readModule(buf);
    t.false(res.ok);
});