// lib/forensics.mjs —— 网络取证纯函数（零 page、零网络，可被 node 直接 import 跑 golden）。
//
// checkErrorEnvelope：判 HTTP 200 但 body 是软失败的「错误信封」。成功字段按 channel 参数化
//   （Heren 实测信封 = {status:200,msg,data}，成功 = status===200；其它 channel 可配 code/0 等），
//   不写死 design 旧假设的 code!=0。落 site.json 的 {successField,successValue}。
//
// fail-safe（异构评审加固 2026-06-29）：缺/坏成功字段配置时返回 ok:false，绝不默认成「信封 ok」——
//   配置漏填不得静默放行软失败（护栏 #14）。
// 凭据红线：本函数只读 body 的成功字段，不碰、不回传 token。

export function checkErrorEnvelope(body, { successField, successValue } = {}) {
  if (typeof successField !== 'string' || successField === '') {
    return { field: successField ?? null, expected: successValue, actual: undefined, ok: false };
  }
  const actual = body == null ? undefined : body[successField];
  return {
    field: successField,
    expected: successValue,
    actual,
    ok: actual === successValue,
  };
}
