import copy from "rollup-plugin-copy";
import rustyWasm from "@nomaton/rollup-plugin-rusty-wasm";
import serve from "rollup-plugin-serve";

const SRC_DIR = "web-esm";
const DIST_DIR = "dist-esm";

export default {
    input: SRC_DIR + "/index.js",
    output: {
        dir: DIST_DIR,
        format: "esm",
    },
    plugins: [
        rustyWasm({
            syncInit: true,
            loadMethod: 'streaming',
        }),
        copy({
            targets: [
                { src: SRC_DIR + "/index.html", dest: DIST_DIR },
            ],
        }),
        serve({
            contentBase: DIST_DIR,
            host: "localhost",
            port: 8080,
        }),
    ],
}
