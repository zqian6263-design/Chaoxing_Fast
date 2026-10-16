/**
 * OpenCode Zen study-assistant adapter.
 * Explicit user invocation only; never sends Chaoxing cookies or course links.
 * Only the allowlisted free model is reachable; paid-model fallback is forbidden.
 */
export const ZEN_ENDPOINT = 'https://opencode.ai/zen/v1/chat/completions';
export const FREE_ZEN_MODEL = 'mimo-v2.6-flash-free';

const SYSTEM = `你是课程学习辅导助手，不是自动提交测验的工具。
回答必须包括：1.本题考查的概念 2.逐项分析和推理 3.如何利用课程资料核对 4.不确定性/缺失条件。
仅根据用户明确提供的题目及课程笔记进行分析，不要声称访问过学习通、成绩系统或老师的答案。
课程资料为空时直说未提供材料。题意不清、图片缺失时请请求补充，禁止编造依据。
不要提供任何自动提交、批量作答或绕过考试限制的步骤。`;

function validateText(value, name, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new TypeError(name + ' 必须是 1–' + max + ' 字的文本');
  }
  if (/\b(?:Cookie:|Authorization:|Bearer\s+\S+|OPENCODE_API_KEY\s*=)/i.test(value)) {
    throw new TypeError('检测到疑似凭据，请删除后再发送');
  }
  return value.trim();
}

export async function explainQuiz({ question, notes = '' }, { apiKey, fetchImpl = fetch, timeoutMs = 30000 } = {}) {
  const q = validateText(question, '题干', 8000);
  if (typeof notes !== 'string' || notes.length > 12000) throw new TypeError('课程笔记不能超过 12000 字');
  if (notes) validateText(notes, '课程笔记', 12000);
  if (!apiKey || typeof apiKey !== 'string') throw new Error('未配置 OpenCode Zen API Key');
  if (timeoutMs < 1000 || timeoutMs > 60000) throw new TypeError('不允许的请求超时时间');

  const response = await fetchImpl(ZEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: FREE_ZEN_MODEL,
      stream: false,
      temperature: 0.2,
      max_tokens: 1400,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify({ question: q, course_notes: notes.trim() }, null, 0) },
      ],
    }),
  });
  if (!response.ok) {
    // Never print response bodies: third-party error responses can echo user text/credentials.
    throw new Error('OpenCode Zen HTTP ' + response.status + (response.status === 429 ? '（限额或限流）' : ''));
  }
  const raw = await response.text();
  if (raw.length > 1_000_000) throw new Error('模型响应超过大小限制');
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error('模型返回的不是有效 JSON'); }
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('模型未返回可用的讲解文本');
  return { model: FREE_ZEN_MODEL, explanation: answer.trim().slice(0, 16000) };
}
