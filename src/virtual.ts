import type * as rollup from "rollup";
import * as wasmlib from "./wasmlib";

const VIRTUAL_ID_PREFIX = "\0mod-wasm"
// NOTE: the prefix can be safely embedded in the regexp pattern.
const re_VIRTUAL_ID = new RegExp('^' + VIRTUAL_ID_PREFIX + '\\?([^+]*)(?:\\+(.*))?$');

export type VirtualModuleKey =
    | { type: 'helper' }
    | { type: 'inline', wasmId: string }
    | { type: 'shared', wasmId: string }
    | { type: 'proxy', wasmId: string }

export function isVirtualId(id: string): boolean {
    return id.startsWith(VIRTUAL_ID_PREFIX + '?');
}

export function composeVirtualId(key: VirtualModuleKey): string {
    switch (key.type) {
        case 'helper':
            return `${VIRTUAL_ID_PREFIX}?${key.type}`;
        case 'inline':
        case 'shared':
        case 'proxy':
            return `${VIRTUAL_ID_PREFIX}?${key.type}+${key.wasmId}`;
    }
}

export function decomposeVirtualId(id: string): VirtualModuleKey | null {
    const match = re_VIRTUAL_ID.exec(id);
    if (match === null) {
        return null;
    }

    const type = match[1];
    switch (type) {
        case 'helper':
            return { type };
        case 'inline':
        case 'shared':
        case 'proxy':
            const wasmId = match[2];
            return { type, wasmId };
        default:
            return null;
    }
}

export async function generateModHelper(): Promise<rollup.LoadResult> {
    const code = `
    export function compileBuffered(url) {
        return fetch(url).then(res => res.arrayBuffer()).then(buf => WebAssembly.compile(buf));
    }

    export function compileStreaming(url) {
        return fetch(url).then(res => WebAssembly.compileStreaming(res));
    }

    export function compileInline(str) {
        const buf = new ArrayBuffer(str.length + 3); // +3 to call getInt32 at the end
        try {
            const encoder = new TextEncoder();
            encoder.encodeInto(str, new Uint8Array(buf));
        } catch (e) {
            // fallback (assuming ascii string)
            const u8s = new Uint8Array(buf);
            for (let i = 0; i < str.length; i++) {
                u8s[i] = str.codePointAt(i);
            }
        }

        const srcLength = str.length;
        const rem = srcLength % 4; // 0 or 2 or 3
        const units = (srcLength - rem) / 4;
        const dstLength = 3 * units + (rem === 0 ? 0 : (rem - 1));

        // decode in-place
        const dv = new DataView(buf);
        for (let srcPos = 0, dstPos = 0; srcPos < srcLength; srcPos += 4, dstPos += 3) {
            // accessing out-range 0 is not significant after the truncation
            const x = dv.getInt32(srcPos) ^ 0x20202020; 
            const y = ((x & 0x3f000000) << 2) | ((x & 0x003f0000) << 4) |
                ((x & 0x00003f00) << 6) | ((x & 0x0000003f) << 8);
            dv.setInt32(dstPos, y);
        }

        const byteCode = new Uint8Array(buf, 0, dstLength);
        return WebAssembly.compile(byteCode);
    }
    `;

    return { code };
}

export async function generateModInline(encoded: string) {
    const code = `export default ${JSON.stringify(encoded)};`

    return { code };
}

export async function generateModShared(
    wasmModule: wasmlib.Module
): Promise<rollup.LoadResult> {
    const properties = new Array<string>();
    for (const { name } of wasmModule.exports) {
        const nameLit = JSON.stringify(name);
        properties.push(
            `get [${nameLit}]() {
                return meta.instance.exports[${nameLit}];
            }`
        );
    }

    const code = `
    export const meta = {
        promise: null,
        module: null,
        instance: null,
    }

    export const proxy = {
        ${properties.join(",\n")}
    };
    `;

    return { code };
}


export async function generateModWasmProxy(
    wasmId: string
): Promise<rollup.LoadResult> {

    const sharedId = composeVirtualId({ type: 'shared', wasmId });
    const code = `
    import { proxy } from ${JSON.stringify(sharedId)};
    export { proxy as default };
    `;

    return { code, syntheticNamedExports: 'default' };
}

export type LoadOptions =
    | { type: 'inline' }
    | { type: 'buffered', refId: string }
    | { type: 'streaming', refId: string };

export type InitOptions = {
    sync: boolean,
    defer: boolean,
    funcName: string,
};

export async function generateModWasm(
    wasmId: string,
    wasmModule: wasmlib.Module,
    loadOptions: LoadOptions,
    initOptions: InitOptions,
): Promise<rollup.LoadResult> {
    // map module id
    const importIdMap = new Map<string, string>();
    for (const import_ of wasmModule.imports) {
        if (!importIdMap.has(import_.module)) {
            const importId = "m" + importIdMap.size.toFixed();
            importIdMap.set(import_.module, importId);
        }
    }

    // code segments
    const codes = new Array<string>(); // to be joined by "\n"

    const helperId = composeVirtualId({ type: 'helper' });
    codes.push(`import * as helper from ${JSON.stringify(helperId)};`);

    const sharedId = composeVirtualId({ type: 'shared', wasmId });
    codes.push(`import {proxy, meta} from ${JSON.stringify(sharedId)};`);

    if (loadOptions.type === 'inline') {
        const inlineId = composeVirtualId({ type: 'inline', wasmId });
        codes.push(`import inline from ${JSON.stringify(inlineId)};`);
    }

    for (const [module_, importId] of importIdMap) {
        codes.push(`import * as ${importId} from ${JSON.stringify(module_)};`);
    }

    let compileExpr = null;
    if (loadOptions.type === 'inline') {
        compileExpr = `helper.compileInline(inline)`;
    } else if (loadOptions.type === 'buffered') {
        const { refId } = loadOptions;
        compileExpr = `helper.compileBuffered(import.meta.ROLLUP_FILE_URL_${refId})`;
    } else if (loadOptions.type === 'streaming') {
        const { refId } = loadOptions;
        compileExpr = `helper.compileStreaming(import.meta.ROLLUP_FILE_URL_${refId})`;
    }

    const importObjectFields = new Array<string>();
    for (const [module_, importId] of importIdMap) {
        importObjectFields.push(`[${JSON.stringify(module_)}]: ${importId}`);
    }

    codes.push(
        `function init() {
            if (meta.promise === null) {
                meta.promise = ${compileExpr}.then(module => {
                    meta.module = module;
                    return WebAssembly.instantiate(module, {
                        ${importObjectFields.join(",\n")}
                    });
                }).then(instance => {
                    meta.instance = instance;
                    return proxy;
                });
            }
            return meta.promise;
        }
    `);

    let moduleSideEffects = false;
    if (initOptions.sync) {
        moduleSideEffects = true;
        codes.push(`await init();`);
    } else if (!initOptions.defer) {
        moduleSideEffects = true;
        codes.push(`init();`);
    }

    codes.push(`export { proxy as default, `);
    if (!initOptions.sync) {
        codes.push(`init as ${initOptions.funcName},`);
    }
    codes.push(`};`);

    const code = codes.join("\n");

    return { code, moduleSideEffects, syntheticNamedExports: 'default' };
}
