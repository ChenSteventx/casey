// Production driver publication root.
//
// 当前没有真实发行签名资源，因此必须诚实保持 empty。测试公钥只由 acceptance gate 的隔离
// ESM loader 提供，绝不能回流此文件。未来启用时只能由 release artifact 中的签名 manifest
// 生成本模块；不得从工作区文件、环境变量或调用者参数动态扩根。
export function driverRegistryReadiness() {
  return Object.freeze({
    ready: false,
    reason: 'DRIVER_NOT_PUBLISHED',
    route: 'human',
    publication: null,
  });
}

export function trustedDriverPublicKeyFor() {
  return null;
}
