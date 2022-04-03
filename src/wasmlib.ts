import { StringDecoder } from "node:string_decoder";

//
// Values
//
export function tryReadU32(buf: Buffer, offset: number): [number, number] | null {
    let v = 0;
    let base = 1;
    for (let i = 0; offset + i < buf.length; i++) {
        const u = buf[offset + i];
        v += (u & 0x7f) * base;
        base *= 128;
        if (v >= 0x100000000) {
            return null;
        }
        if ((u & 0x80) === 0) {
            return [v, i + 1];
        }
    }
    return null;
}

export function tryReadName(buf: Buffer, offset: number): [string, number] | null {
    // TODO: strict utf-8 validation
    let pos = offset;

    const maybeLength = tryReadU32(buf, pos);
    if (maybeLength === null) {
        return null;
    }
    const [length, delta] = maybeLength;
    pos += delta;

    if (pos + length > buf.length) {
        return null;
    }
    const nameBuf = buf.subarray(pos, pos + length);
    const name = new StringDecoder().end(nameBuf);
    pos += length;

    return [name, pos - offset];
}

//
// Types
//
export type NumType = 'i32' | 'i64' | 'f32' | 'f64';
export type RefType = 'funcref' | 'externref';
export type ValType = NumType | RefType;

export type Limits = { min: number, max: number | undefined }
export type MemType = { limits: Limits };
export type TableType = { type: RefType, limits: Limits };
export type GlobalType = { type: ValType, mut: boolean };

export function tryReadRefType(buf: Buffer, offset: number): [RefType, number] | null {
    if (offset >= buf.length) {
        return null;
    }
    const tag = buf[offset];
    switch (tag) {
        case 0x70:
            return ['funcref', 1];
        case 0x6f:
            return ['externref', 1];
        default:
            return null;
    }
}

export function tryReadValType(buf: Buffer, offset: number): [ValType, number] | null {
    if (offset >= buf.length) {
        return null;
    }
    const tag = buf[offset];
    switch (tag) {
        case 0x7f:
            return ['i32', 1];
        case 0x7e:
            return ['i64', 1];
        case 0x7d:
            return ['f32', 1];
        case 0x7c:
            return ['f64', 1];
        case 0x70:
            return ['funcref', 1];
        case 0x6f:
            return ['externref', 1];
        default:
            return null;
    }
}

export function tryReadLimits(buf: Buffer, offset: number): [Limits, number] | null {
    let pos = offset;

    if (pos >= buf.length) {
        return null;
    }
    const tag = buf[pos];
    if (tag !== 0x00 && tag !== 0x01) {
        return null;
    }
    pos += 1;

    const maybeMin = tryReadU32(buf, pos);
    if (maybeMin === null) {
        return null;
    }
    const [min, minDelta] = maybeMin;
    pos += minDelta;

    if (tag === 0x00) {
        return [{ min, max: undefined }, pos - offset];
    }

    const maybeMax = tryReadU32(buf, pos);
    if (maybeMax === null) {
        return null;
    }
    const [max, maxDelta] = maybeMax;
    pos += maxDelta;

    return [{ min, max }, pos - offset];
}

export function tryReadMemType(buf: Buffer, offset: number): [MemType, number] | null {
    const maybeLimit = tryReadLimits(buf, offset);
    if (maybeLimit === null) {
        return null;
    }
    const [limits, delta] = maybeLimit;

    return [{ limits }, delta];
}

export function tryReadTableType(buf: Buffer, offset: number): [TableType, number] | null {
    let pos = offset;

    const maybeType = tryReadRefType(buf, pos);
    if (maybeType === null) {
        return null;
    }
    const [type, typeDelta] = maybeType;
    pos += typeDelta;

    const maybeLimits = tryReadLimits(buf, pos);
    if (maybeLimits === null) {
        return null;
    }
    const [limits, limitsDelta] = maybeLimits;
    pos += limitsDelta;

    return [{ type, limits }, pos - offset];
}

export function tryReadGlobalType(buf: Buffer, offset: number): [GlobalType, number] | null {
    let pos = offset;

    const maybeType = tryReadValType(buf, pos);
    if (maybeType === null) {
        return null;
    }
    const [type, typeDelta] = maybeType;
    pos += typeDelta;

    if (pos >= buf.length) {
        return null;
    }
    const mutCode = buf[pos];
    let mut: boolean;
    switch (mutCode) {
        case 0x00:
            mut = false;
            break;
        case 0x01:
            mut = true;
            break;
        default:
            return null;
    }
    pos += 1;

    return [{ type, mut }, pos - offset];
}

//
// Import Section
//
export type Import = { module: string, name: string, desc: ImportDesc };
export type ImportDesc =
    | { tag: 'func', typeIdx: number }
    | { tag: 'table', type: RefType, limits: Limits }
    | { tag: 'mem', limits: Limits }
    | { tag: 'global', type: ValType, mut: boolean }

export function tryReadImportSection(buf: Buffer, offset: number): [Array<Import>, number] | null {
    let pos = offset;

    const maybeCount = tryReadU32(buf, pos);
    if (maybeCount === null) {
        return null;
    }
    const [count, countDelta] = maybeCount;
    pos += countDelta;

    const items: Array<Import> = [];
    for (let i = 0; i < count; i++) {
        const maybeImport = tryReadImport(buf, pos);
        if (maybeImport === null) {
            return null;
        }
        const [import_, importDelta] = maybeImport;
        pos += importDelta;
        items.push(import_);
    }

    return [items, pos - offset];
}

export function tryReadImport(buf: Buffer, offset: number): [Import, number] | null {
    let pos = offset;

    const maybeModule = tryReadName(buf, pos);
    if (maybeModule === null) {
        return null;
    }
    const [module, moduleDelta] = maybeModule;
    pos += moduleDelta;

    const maybeName = tryReadName(buf, pos);
    if (maybeName === null) {
        return null;
    }
    const [name, nameDelta] = maybeName;
    pos += nameDelta;

    const maybeDesc = tryReadImportDesc(buf, pos);
    if (maybeDesc === null) {
        return null;
    }
    const [desc, descDelta] = maybeDesc;
    pos += descDelta;

    return [{ module, name, desc }, pos - offset];
}

export function tryReadImportDesc(buf: Buffer, offset: number): [ImportDesc, number] | null {
    let pos = offset;

    if (pos >= buf.length) {
        return null;
    }
    let tagCode = buf[pos];
    pos += 1;

    let desc: ImportDesc;
    if (tagCode === 0x00) {
        // func
        const maybeTypeIdx = tryReadU32(buf, pos);
        if (maybeTypeIdx === null) {
            return null;
        }
        const [typeIdx, delta] = maybeTypeIdx;
        pos += delta;
        desc = { tag: 'func', typeIdx };
    } else if (tagCode === 0x01) {
        // table
        const maybeTableType = tryReadTableType(buf, pos);
        if (maybeTableType === null) {
            return null;
        }
        const [{ type, limits }, delta] = maybeTableType;
        pos += delta;
        desc = { tag: 'table', type, limits }
    } else if (tagCode === 0x02) {
        // mem
        const maybeMemType = tryReadMemType(buf, pos);
        if (maybeMemType === null) {
            return null;
        }
        const [{ limits }, delta] = maybeMemType;
        pos += delta;
        desc = { tag: 'mem', limits };
    } else if (tagCode === 0x03) {
        // global
        const maybeGlobalType = tryReadGlobalType(buf, pos);
        if (maybeGlobalType === null) {
            return null;
        }
        const [{ type, mut }, delta] = maybeGlobalType;
        pos += delta;
        desc = { tag: 'global', type, mut };
    } else {
        // invalid
        return null;
    }

    return [desc, pos - offset];
}

//
// Import Section
//
export type Export = { name: string, desc: ExportDesc };
export type ExportDesc =
    | { tag: 'func', idx: number }
    | { tag: 'table', idx: number }
    | { tag: 'mem', idx: number }
    | { tag: 'global', idx: number }

export function tryReadExportSection(buf: Buffer, offset: number): [Array<Export>, number] | null {
    let pos = offset;

    const maybeCount = tryReadU32(buf, pos);
    if (maybeCount === null) {
        return null;
    }
    const [count, countDelta] = maybeCount;
    pos += countDelta;

    const items: Array<Export> = [];
    for (let i = 0; i < count; i++) {
        const maybeExport = tryReadExport(buf, pos);
        if (maybeExport === null) {
            return null;
        }
        const [export_, exportDelta] = maybeExport;
        pos += exportDelta;
        items.push(export_);
    }

    return [items, pos - offset];
}

export function tryReadExport(buf: Buffer, offset: number): [Export, number] | null {
    let pos = offset;

    const maybeName = tryReadName(buf, pos);
    if (maybeName === null) {
        return null;
    }
    const [name, nameDelta] = maybeName;
    pos += nameDelta;

    const maybeDesc = tryReadExportDesc(buf, pos);
    if (maybeDesc === null) {
        return null;
    }
    const [desc, descDelta] = maybeDesc;
    pos += descDelta;

    return [{ name, desc }, pos - offset];
}

export function tryReadExportDesc(buf: Buffer, offset: number): [ExportDesc, number] | null {
    let pos = offset;

    if (pos >= buf.length) {
        return null;
    }
    let tagCode = buf[pos];
    pos += 1;

    let desc: ExportDesc;
    if (tagCode === 0x00) {
        // func
        const maybeIdx = tryReadU32(buf, pos);
        if (maybeIdx === null) {
            return null;
        }
        const [idx, delta] = maybeIdx;
        pos += delta;
        desc = { tag: 'func', idx };
    } else if (tagCode === 0x01) {
        // table
        const maybeIdx = tryReadU32(buf, pos);
        if (maybeIdx === null) {
            return null;
        }
        const [idx, delta] = maybeIdx;
        pos += delta;
        desc = { tag: 'table', idx }
    } else if (tagCode === 0x02) {
        // mem
        const maybeIdx = tryReadU32(buf, pos);
        if (maybeIdx === null) {
            return null;
        }
        const [idx, delta] = maybeIdx;
        pos += delta;
        desc = { tag: 'mem', idx };
    } else if (tagCode === 0x03) {
        // global
        const maybeIdx = tryReadU32(buf, pos);
        if (maybeIdx === null) {
            return null;
        }
        const [idx, delta] = maybeIdx;
        pos += delta;
        desc = { tag: 'global', idx };
    } else {
        // invalid
        return null;
    }

    return [desc, pos - offset];
}

//
// Module
//

// currently, sections other than imports and exports are ignored.

export type Module = {
    version: number,
    imports: Array<Import>,
    exports: Array<Export>,
}

export type ReadModuleResult =
    | { ok: true, value: Module }
    | { ok: false, error: string }

export function readModule(buf: Buffer): ReadModuleResult {
    const end = buf.length;
    let pos = 0;

    if (buf.length < 8) {
        return { ok: false, error: "invalid module head" };
    } else if (buf[0] !== 0x00 || buf[1] !== 0x61 || buf[2] !== 0x73 || buf[3] !== 0x6d) {
        return { ok: false, error: "invalid wasm magic" };
    }
    const version = buf.readInt32LE(4);
    pos += 8;

    let imports: null | Array<Import> = null;
    let exports: null | Array<Export> = null;

    while (pos < end) {
        const tagCode = buf[pos];
        pos += 1;

        const maybeSize = tryReadU32(buf, pos);
        if (maybeSize === null) {
            return { ok: false, error: "invalid section size" };
        }
        const [size, sizeDelta] = maybeSize;
        pos += sizeDelta;

        if (pos + size > end) {
            return { ok: false, error: "incomplete section" };
        }
        const section = buf.subarray(pos, pos + size);
        pos += size;

        if (tagCode === 2) {
            // imports
            if (imports !== null) {
                return { ok: false, error: "multiple import sections" };
            }

            const maybeImports = tryReadImportSection(section, 0);
            if (maybeImports === null) {
                return { ok: false, error: "invalid import section" };
            }
            const [importsRead, importsDelta] = maybeImports;
            if (importsDelta !== size) {
                return { ok: false, error: "import section size unmatch" };
            }
            imports = importsRead;
        } else if (tagCode === 7) {
            // exports
            if (exports !== null) {
                return { ok: false, error: "multiple export sections" };
            }

            const maybeExports = tryReadExportSection(section, 0);
            if (maybeExports === null) {
                return { ok: false, error: "invalid export section" };
            }
            const [exportsRead, exportsDelta] = maybeExports;
            if (exportsDelta !== size) {
                return { ok: false, error: "export section size unmatch" };
            }
            exports = exportsRead;
        }
    }

    if (imports === null) {
        imports = [];
    }
    if (exports === null) {
        exports = [];
    }

    return {
        ok: true, value: {
            version, imports, exports,
        }
    };
}