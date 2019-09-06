"use strict";

import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import builtins from 'rollup-plugin-node-builtins';

import { terser } from "rollup-plugin-terser";


export default commandLineArgs => {
    let minify = commandLineArgs.configMinify;

    let output = "./dist/takoyaki.umd.js";
    const plugins = [
        builtins(),
        resolve({
            mainFields: [ "browser", "module", "main" ]
        }),
        commonjs({ })
    ];

    if (minify) {
        output = "./dist/takoyaki.umd.min.js"
        plugins.push(terser());
    }

    return {
        input: "./lib/index.js",
        output: {
            file: output,
            format: "umd",
            name: "Takoyaki",
            exports: "named",
        },
        plugins: plugins
    };
}

