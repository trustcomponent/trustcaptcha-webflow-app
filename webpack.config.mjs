import path from "path";
import { fileURLToPath } from "url";
import TerserPlugin from "terser-webpack-plugin";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const isProd = process.env.NODE_ENV === "production";

export default {
    entry: "./src/index.ts",
    output: {
        filename: "bundle.js",
        path: path.resolve(dirname, "public"),
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".json"],
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                exclude: /node_modules/,
                use: "ts-loader",
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
            },
        ],
    },
    mode: isProd ? "production" : "development",
    devtool: isProd ? false : "eval-cheap-module-source-map",
    optimization: {
        minimize: isProd,
        minimizer: [
            new TerserPlugin({
                extractComments: false,
                terserOptions: {
                    format: { comments: false },
                    compress: {
                        passes: 2,
                        pure_getters: true,
                    },
                },
            }),
        ],
    },
    performance: { hints: false },
    devServer: {
        static: [{ directory: path.join(dirname, "public") }],
        compress: true,
        port: 3000,
    },
};
