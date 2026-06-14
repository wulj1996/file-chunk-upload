const path = require('path');

// 公共配置
const common = {
  entry: './src/index.ts',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: { transpileOnly: true },
        },
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    react: {
      commonjs: 'react',
      commonjs2: 'react',
      amd: 'react',
      root: 'React',
    },
  },
};

// UMD 输出（浏览器 <script> 引入 / 兼容 AMD）
const umd = {
  ...common,
  name: 'umd',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.umd.js',
    library: {
      name: 'FileChunkUpload',
      type: 'umd',
      export: 'default',
    },
    globalObject: 'this',
  },
};

// CommonJS 输出（Node.js / webpack require）
const cjs = {
  ...common,
  name: 'cjs',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    library: {
      type: 'commonjs2',
    },
  },
};

// ESM 输出（支持 tree-shaking）
const esm = {
  ...common,
  name: 'esm',
  experiments: {
    outputModule: true,
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.esm.js',
    library: {
      type: 'module',
    },
  },
};

module.exports = [umd, cjs, esm];
