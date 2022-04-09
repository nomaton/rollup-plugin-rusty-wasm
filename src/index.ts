import type { EmittedAsset, Plugin, PluginContext } from "rollup";

import * as fs from "node:fs";
import * as path from "node:path";

import * as wasmlib from "./wasmlib";
import * as virtual from "./virtual";
import * as inline from "./inline";
import { Options, NormalizedOptions, normalize, NormalizedRenameWasm } from "./options";

const PLUGIN_NAME = "rusty-wasm";
const REG_WASM = /\.wasm$/i;

type WasmData = {
    binary: Buffer,
    analysed: wasmlib.Module,
}

export default function rustyWasm(options: Options): Plugin {

    let wasmCache = new Map<string, WasmData>();
    let normalizedOptions: null | NormalizedOptions = null;

    return {
        name: PLUGIN_NAME,

        buildStart: async function () {
            if (normalizedOptions === null) {
                let warnings: Array<string>;
                [normalizedOptions, warnings] = normalize(options);
                for (const warning of warnings) {
                    this.warn(warning);
                }
            }

            wasmCache.clear();
        },

        resolveId: async function (source, importer, options) {
            if (virtual.isVirtualId(source)) {
                // pass virtual id as is.
                return source;
            } else {
                return null;
            }
        },

        load: async function (id: string) {
            if (virtual.isVirtualId(id)) {
                const key = virtual.decomposeVirtualId(id);
                if (key === null) {
                    this.error(`failed in decomposing virtual id (plugin bug)`);

                } else if (key.type === 'helper') {
                    return virtual.generateModHelper();

                } else if (key.type === 'inline') {
                    const { wasmId } = key;
                    const wasmData = wasmCache.get(wasmId);
                    if (wasmData === undefined) {
                        this.error(`failed in getting cached wasm data (plugin bug)`)
                    }

                    const { binary } = wasmData;
                    const encoded = inline.encode(binary);

                    return virtual.generateModInline(encoded);

                } else if (key.type === 'shared') {
                    const { wasmId } = key;
                    const wasmData = wasmCache.get(wasmId);
                    if (wasmData === undefined) {
                        this.error(`failed in getting cached wasm data (plugin bug)`)
                    }

                    return virtual.generateModShared(wasmData.analysed);

                } else if (key.type === 'proxy') {
                    const { wasmId } = key;
                    return virtual.generateModWasmProxy(wasmId);

                } else {
                    this.error(`failed in loading virtual id (plugin bug)`);

                }

            } else if (REG_WASM.test(id)) {
                const wasmId = id;
                const wasmOptions = normalizedOptions!.getWasmOptions(wasmId);
                const wasmBinary = await fs.promises.readFile(wasmId);

                const readModule = wasmlib.readModule(wasmBinary);
                if (!readModule.ok) {
                    this.error(`failed in reading wasm "${id}"`);
                }
                const wasmAnalised = readModule.value;
                wasmCache.set(wasmId, { binary: wasmBinary, analysed: wasmAnalised });

                let loadOptions: virtual.LoadOptions;
                if (wasmOptions.loadMethod === 'inline') {
                    loadOptions = { type: 'inline' };
                } else {
                    const refId = emitWasmFile(this, wasmId, wasmBinary, wasmOptions.renameWasm);
                    loadOptions = { type: wasmOptions.loadMethod, refId };
                }

                let initOptions: virtual.InitOptions;
                initOptions = {
                    sync: wasmOptions.syncInit,
                    defer: wasmOptions.deferInit,
                    funcName: wasmOptions.initFuncName,
                };

                return virtual.generateModWasm(wasmId, wasmAnalised, loadOptions, initOptions);

            } else {
                return null;

            }

        }

    };
}

function emitWasmFile(
    context: PluginContext,
    wasmId: string,
    wasmBinary: Buffer,
    renameWasm: NormalizedRenameWasm,
): string {
    const info = { type: 'asset', source: wasmBinary } as EmittedAsset;

    const fileName = path.basename(wasmId);

    if (renameWasm.tag === 'preserve') {
        info.fileName = fileName;
    } else if (renameWasm.tag === 'auto') {
        // pass        
    } else if (renameWasm.tag === 'fileName') {
        info.fileName = renameWasm.fileName;
    } else if (renameWasm.tag === 'prefix') {
        info.fileName = renameWasm.prefix + fileName;
    } else if (renameWasm.tag === 'name') {
        info.name = renameWasm.name;
    }

    return context.emitFile(info);
}