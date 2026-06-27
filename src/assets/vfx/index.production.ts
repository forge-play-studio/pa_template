// prod 构建入口。已统一到 glob barrel:index.ts 在 __PROD_BUILD__ 下自动过滤为 production 集合,
// 故此处仅做 re-export(消费方仍可显式引用本文件)。
export * from './index';
