/**
 * Gemini API study-tutor adapter: manual requests, fixed free-tier-eligible model.
 * No automatic retries, paid-model fallback or Chaoxing session forwarding.
 * A Google project must be verified as Free tier in AI Studio; this code
 * cannot determine the billing tier of an arbitrary API key.
 */
export const GEMINI_MODEL = 'gemini-2.5-flash-lite';
export const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

const SYSTEM = `你是课程学习辅导助手，不是自动提交测验的工具。
回答必须包括：1.本题考查的概念 2.逐项分析和推理 3.如何利用课程资料核对 4.不确定性/缺失条件。
仅根据用户明确提供的题目及课程笔记进行分析，不要声称访问过学习通、成绩系统或老师的答案。
课程资料为空时直说未提供材料。题意不清、图片缺失时请请求补充，禁止编造依据。
不要提供任何自动提交、批量作答或绕过考试限制的步骤。`;

export function validateText(value, name, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new TypeError(name + ' 必须是 1–' + max + ' 字的文本');
  }
  // The study input must not contain secrets or credential headers.
  if (/(?:cookie\s*:|authorization\s*:|bearer\s+\S+|(?:GEMINI|GOOGLE|OPENCODE)_API_KEY\s*=|AIza[0-9A-Za-z_-]{20,})/i.test(value)) {
    throw new TypeError('检测到疑似凭据，请删除后再发送');
  }
  return value.trim();
}

export async function explainQuiz({ question, notes = '' }, {
  apiKey, fetchImpl = fetch, timeoutMs = 30000,
} = {}) {
  const q = validateText(question, '题干', 8000);
  if (typeof notes !== 'string' || notes.length > 12000) {
    throw new TypeError('课程笔记不能超过 12000 字');
  }
  if (notes.trim()) validateText(notes, '课程笔记', 12000);
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('未配置 Gemini API Key');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
    throw new TypeError('不允许的请求超时时间');
  }
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify({ question: q, course_notes: notes.trim() }) }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1400 },
  };
  // This client explicitly sends only one POST to one allowlisted model.
  const response = await fetchImpl(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey.trim(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    // Do not include provider response bodies; they might echo sensitive input.
    const descriptions = {
      400: '（请求格式错误）',
      401: '（身份验证失败）',
      403: '（项目权限不足、模型不可用或地区受限）',
      404: '（模型在当前项目不可用）',
      429: '（已达到免费配额或速率限制）',
    };
    throw new Error('Gemini API HTTP ' + response.status + (descriptions[response.status] || ''));
  }
  const raw = await response.text();
  if (raw.length > 1_000_000) throw new Error('模型响应超过大小限制');
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error('模型返回的不是有效 JSON'); }
  const answer = (data?.candidates?.[0]?.content?.parts || [])
    .map(p => typeof p?.text === 'string' ? p.text : '')
    .filter(Boolean)
    .join('\n');
  if (!answer.trim()) {
    const finish = data?.candidates?.[0]?.finishReason;
    throw new Error(finish === 'SAFETY'
      ? 'Gemini 安全策略阻止了此次响应'
      : 'Gemini 未返回可用的讲解文本');
  }
  return { model: GEMINI_MODEL, provider: 'Google Gemini', explanation: answer.trim().slice(0, 16000) };
}
