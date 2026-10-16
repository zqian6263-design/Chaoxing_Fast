/**
 * DeepSeek API adapter: manual study explanations using the lower-cost Flash model.
 * API usage is billed by DeepSeek; the dashboard requires explicit acknowledgement.
 * No Chaoxing session cookies or automatic retries are sent to the provider.
 */
export const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
export const DEEPSEEK_MODEL = 'deepseek-flash';

const SYSTEM = `你是课程学习辅导助手，不是自动提交测验的工具。
请说明：1.题目考查的知识点 2.逐项分析和推理 3.如何根据课程资料自行核对 4.不确定性和缺失条件。
只依据用户明确提供的题目与笔记，不要声称访问学习通、成绩系统或标准答案。
若缺少资料请如实说明，遇到图像或题意不完整时请求补充。
不要执行自动填答、批量提交或其他更改测验状态的操作。`;

function textInput(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new TypeError(label + ' 必须是 1–' + maxLength + ' 字的文本');
  }
  if (/(?:cookie\s*:|authorization\s*:|bearer\s+\S+|(?:DEEPSEEK|GEMINI|GOOGLE|OPENCODE)_API_KEY\s*=|AIza[0-9A-Za-z_-]{20,})/i.test(value)) {
    throw new TypeError('检测到疑似凭据，请删除后再发送');
  }
  return value.trim();
}

export async function explainQuiz({ question, notes = '' }, {
  apiKey, fetchImpl = fetch, timeoutMs = 30000,
} = {}) {
  const q = textInput(question, '题干', 8000);
  if (typeof notes !== 'string' || notes.length > 12000) {
    throw new TypeError('课程笔记不能超过 12000 字');
  }
  if (notes.trim()) textInput(notes, '课程笔记', 12000);
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('未配置 DEEPSEEK_API_KEY');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
    throw new TypeError('不允许的请求超时时间');
  }

  const response = await fetchImpl(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey.trim(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify({ question: q, course_notes: notes.trim() }) },
      ],
      // Disable extended thinking to keep cost and latency bounded for tutorial hints.
      thinking: { type: 'disabled' },
      stream: false,
      max_tokens: 700,
    }),
  });
  if (!response.ok) {
    const messages = {
      400: '（请求参数错误）',
      401: '（API Key 无效）',
      402: '（账户余额不足或未启用 API 服务）',
      403: '（服务端权限或地区限制）',
      429: '（请求触发限流）',
    };
    throw new Error('DeepSeek API HTTP ' + response.status + (messages[response.status] || ''));
  }
  // Do not log the provider body: it can contain user-provided study material.
  const raw = await response.text();
  if (raw.length > 1_000_000) throw new Error('模型响应超过大小限制');
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error('模型返回的不是有效 JSON'); }
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('模型未返回可用的讲解文本');
  return {
    provider: 'DeepSeek',
    model: DEEPSEEK_MODEL,
    explanation: answer.trim().slice(0, 16000),
    usage: {
      inputTokens: Number.isFinite(data.usage?.prompt_tokens) ? data.usage.prompt_tokens : null,
      outputTokens: Number.isFinite(data.usage?.completion_tokens) ? data.usage.completion_tokens : null,
    },
  };
}
