import type { PluginContext } from "rollup";
import * as path from "node:path";

// for declaration
export type Options = undefined | OptionItem | Array<OptionItem>;

export type OptionItem = {
    target?: string,
    loadMethod?: LoadMethod,
    renameWasm?: RenameWasm,
    syncInit?: boolean,
    deferInit?: boolean,
    initFuncName?: string,
};

export type LoadMethod = 'buffered' | 'streaming' | 'inline';

export type RenameWasm =
    | boolean
    | string
    | { prefix: string }
    | { fileName: string }
    | { name: string, noExt?: boolean }

export function normalize(rawOptions: unknown): [NormalizedOptions, Array<string>] {
    const warnings = new Array<string>();
    const normalized = new NormalizedOptionsImpl(rawOptions, warnings);
    const uniqWarnings = warnings.filter((v, i, arr) => arr.indexOf(v) === i);
    return [normalized, uniqWarnings];
}

export interface NormalizedOptions {
    getWasmOptions(wasmId: string): WasmOptions;
}

export type WasmOptions = {
    loadMethod: LoadMethod,
    renameWasm: NormalizedRenameWasm,
    syncInit: boolean,
    deferInit: boolean,
    initFuncName: string,
}

export type NormalizedRenameWasm =
    | { tag: 'preserve' }
    | { tag: 'auto' }
    | { tag: 'prefix', prefix: string }
    | { tag: 'name', name: string }
    | { tag: 'fileName', fileName: string }


//
// internal
//

type TargetPred = (id: string) => boolean;

type NormalizedOptionItem = {
    targetPred: TargetPred,
    loadMethod?: LoadMethod,
    renameWasm?: NormalizedRenameWasm,
    syncInit?: boolean,
    deferInit?: boolean,
    initFuncName?: string,
};

class NormalizedOptionsImpl implements NormalizedOptions {

    items: Array<NormalizedOptionItem>;

    constructor(raw: unknown, warnings: Array<string>) {
        let rawItems: Array<unknown>;
        if (raw === undefined) {
            rawItems = [];
        } else if (raw instanceof Array) {
            rawItems = raw;
        } else if (raw instanceof Object) {
            rawItems = [raw];
        } else {
            warnings.push("options must be object, array or undefined (discarded to use default)");
            rawItems = [];
        }

        this.items = [];
        for (const rawItem of rawItems) {
            if (rawItem === undefined || rawItem === null) {
                continue;
            } else if (!(rawItem instanceof Object)) {
                warnings.push("options.item must be object (discarded)");
                continue;
            }

            const fields = new Map<string, unknown>();
            for (const key in rawItem) {
                const value = (rawItem as any)[key];
                fields.set(key, value);
            }

            const targetPred = normalizeTargetPred(fields.get('target'), warnings);
            fields.delete('target');

            const loadMethod = normalizeLoadMethod(fields.get('loadMethod'), warnings);
            fields.delete('loadMethod');

            const renameWasm = normalizeRenameWasm(fields.get('renameWasm'), warnings);
            fields.delete('renameWasm');

            const syncInit = normalizeSyncInit(fields.get('syncInit'), warnings);
            fields.delete('syncInit');

            const deferInit = normalizeDeferInit(fields.get('deferInit'), warnings);
            fields.delete('deferInit');

            const initFuncName = normalizeInitFuncName(fields.get('initFuncName'), warnings);
            fields.delete('initFuncName');

            this.items.push({
                targetPred,
                loadMethod,
                renameWasm,
                syncInit,
                deferInit,
                initFuncName,
            });

            for (const key of fields.keys()) {
                warnings.push(`options have unused field "${key}" (ignored)`);
            }
        }
    }

    getWasmOptions(wasmId: string): WasmOptions {
        // default values
        let loadMethod = 'buffered' as LoadMethod;
        let renameWasm = { tag: 'preserve' } as NormalizedRenameWasm;
        let syncInit = false;
        let deferInit = false;
        let initFuncName = 'init';

        for (const item of this.items) {
            if (!item.targetPred(wasmId)) {
                continue;
            }
            if (item.loadMethod !== undefined) {
                loadMethod = item.loadMethod;
            }
            if (item.renameWasm !== undefined) {
                renameWasm = item.renameWasm;
            }
            if (item.syncInit !== undefined) {
                syncInit = item.syncInit;
            }
            if (item.deferInit !== undefined) {
                deferInit = item.deferInit;
            }
            if (item.initFuncName !== undefined) {
                initFuncName = item.initFuncName;
            }
        }

        return {
            loadMethod, renameWasm, syncInit, deferInit, initFuncName,
        }
    }
}

function normalizeTargetPred(raw: unknown, warnings: Array<string>): TargetPred {
    if (raw === undefined) {
        return () => true;
    } else if (typeof raw !== 'string') {
        warnings.push("options.target must be string (never match)");
        return () => false;
    } else {
        const isDir = raw.endsWith('/');
        let prefix = path.resolve(raw);
        // resolve may remove the trailing sep
        if (isDir && !(prefix.endsWith(path.sep))) {
            prefix += path.sep;
        }
        return makePrefixPred(prefix);
    }
}

function makePrefixPred(prefix: string): TargetPred {
    return (id) => id.startsWith(prefix);
}

function normalizeLoadMethod(raw: unknown, warnings: Array<string>): undefined | LoadMethod {
    switch (raw) {
        case undefined:
        case 'buffered':
        case 'streaming':
        case 'inline':
            return raw;
        default:
            warnings.push("options.loadMethod must be one of 'buffered', 'streaming' or 'inline' (discarded)");
            return undefined;
    }
}

function normalizeRenameWasm(raw: unknown, warnings: Array<string>): undefined | NormalizedRenameWasm {
    if (typeof raw === 'string') {
        raw = { name: raw };
    }

    if (raw === undefined) {
        return undefined;
    } else if (raw === false) {
        return { tag: 'preserve' };
    } else if (raw === true) {
        return { tag: 'auto' };
    } else if (raw instanceof Object && !(raw instanceof Array)) {
        let count = 0;
        const fields = new Map<string, unknown>();
        for (const key in raw) {
            switch (key) {
                case 'prefix':
                case 'name':
                case 'fileName':
                    count++;
            }
            const value = (raw as any)[key];
            fields.set(key, value);
        }
        if (count > 1) {
            warnings.push("options.renameWasm must have just one of 'prefix', 'name' or 'fileName' (discarded)");
            return undefined;
        }

        let renameWasm: NormalizedRenameWasm;

        if (fields.has('prefix')) {
            const prefix = fields.get('prefix');
            fields.delete('prefix');

            if (typeof prefix !== 'string') {
                warnings.push("options.renameWasm.prefix must be string (discarded)");
                return undefined;
            }

            renameWasm = { tag: 'prefix', prefix };

        } else if (fields.has('name')) {
            const name = fields.get('name');
            const noExt = fields.get('noExt');
            fields.delete('name');
            fields.delete('noExt');

            if (typeof name !== 'string') {
                warnings.push("options.renameWasm.name must be string (discarded)");
                return undefined;
            }

            if (noExt !== undefined && typeof noExt !== 'boolean') {
                warnings.push("options.renameWasm.noExt must be boolean (discarded)");
                return undefined;
            }

            for (const key of fields.keys()) {
                warnings.push(`options.renameWasm has unused field "${key}" (ignored)`);
            }

            if (path.extname(name) !== '' || noExt) {
                renameWasm = { tag: 'name', name: name };
            } else {
                renameWasm = { tag: 'name', name: name + '.wasm' };
            }

        } else if (fields.has('fileName')) {
            const fileName = fields.get('fileName');
            fields.delete('fileName');

            if (typeof fileName !== 'string') {
                warnings.push("options.renameWasm.fileName must be string (discarded)");
                return undefined;
            }

            renameWasm = { tag: 'fileName', fileName };

        } else {
            warnings.push("options.renameWasm must have just one of 'prefix', 'name' or 'fileName' (discarded)");
            return undefined;
        }

        for (const key of fields.keys()) {
            warnings.push(`options.renameWasm has unknown field "${key}" (ignored)`);
        }
        return renameWasm;

    } else {
        warnings.push("options.renameWasm must be boolean, string or object (dicarded)");
        return undefined;
    }
}

function normalizeSyncInit(raw: unknown, warnings: Array<string>): undefined | boolean {
    if (raw === undefined) {
        return undefined;
    } else if (typeof raw === 'boolean') {
        return raw;
    } else {
        warnings.push("options.syncInit should be boolean (coerced)");
        return Boolean(raw);
    }
}

function normalizeDeferInit(raw: unknown, warnings: Array<string>): undefined | boolean {
    if (raw === undefined) {
        return undefined;
    } else if (typeof raw === 'boolean') {
        return raw;
    } else {
        warnings.push("options.deferInit should be boolean (coerced)");
        return Boolean(raw);
    }
}

function normalizeInitFuncName(raw: unknown, warnings: Array<string>): undefined | string {
    if (raw === undefined) {
        return undefined;
    } else if (typeof raw === 'string') {
        return raw;
    } else {
        warnings.push("options.initFuncName must be string (discarded)");
        return undefined;
    }
}