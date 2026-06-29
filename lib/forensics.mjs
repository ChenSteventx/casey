// lib/forensics.mjs —— 网络取证纯函数（零 page、零网络，可被 node 直接 import 跑 golden）。
//
// checkErrorEnvelope：判 HTTP 200 但 body 是软失败的「错误信封」。成功字段按 channel 参数化
//   （Heren 实测信封 = {status:200,msg,data}，成功 = status===200；其它 channel 可配 code/0 等），
//   不写死 design 旧假设的 code!=0。落 site.json 的 {successField,successValue}。
//
// fail-safe（异构评审加固 2026-06-29）：缺/坏成功字段配置时返回 ok:false，绝不默认成「信封 ok」——
//   配置漏填不得静默放行软失败（护栏 #14）。
// 凭据红线：本函数只读 body 的成功字段，不碰、不回传 token。

// 敏感字段名 denylist（护栏 #7）：successField 误配成凭据字段时，绝不读取、绝不回传其值（只回 field 名 + ok:false）。
const SENSITIVE_FIELD = /(^|[_.\-])(token|auth|authorization|cookie|secret|password|passwd|pwd|credential|apikey|api_key|session)([_.\-]|$)/i;

export function checkErrorEnvelope(body, { successField, successValue } = {}) {
  // fail-closed：成功字段名缺失/空白/敏感 一律不放行（护栏 #14/#7）。
  if (typeof successField !== 'string' || successField.trim() === '' || SENSITIVE_FIELD.test(successField)) {
    return { field: typeof successField === 'string' ? successField : null, expected: successValue, actual: undefined, ok: false };
  }
  // 真异构评审 B6（2026-06-29 codex gpt-5.5）：缺 successValue 配置、或 body 缺该字段时，
  //   原版 actual===undefined===successValue 会假判 ok:true（把软失败信封洗成正常）。配置/字段不全一律 fail-closed。
  if (successValue === undefined) {
    return { field: successField, expected: successValue, actual: undefined, ok: false };
  }
  const present = body != null && Object.prototype.hasOwnProperty.call(body, successField);
  const actual = present ? body[successField] : undefined;
  return { field: successField, expected: successValue, actual, ok: present && actual === successValue };
}
