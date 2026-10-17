/**
 * Parse currently rendered, user-visible Chaoxing quiz questions.
 * This function runs inside Playwright's browser page via frame.evaluate.
 * It does not read hidden inputs, click options, modify DOM, or submit anything.
 */
export function extractQuestionsFromPage() {
  const trim = value => String(value || '').replace(/\s+/g, ' ').trim();
  const roots = [...document.querySelectorAll('.TiMu.newTiMu, .TiMu:not(.newTiMu)')];
  const questions = [];
  for (const [i, root] of roots.entries()) {
    const heading = root.querySelector('.Zy_TItle');
    const stemNode = heading?.querySelector('.fontLabel');
    if (!stemNode) continue;
    const marker = trim(stemNode.querySelector('.newZy_TItle')?.textContent);
    const stem = trim(stemNode.innerText || stemNode.textContent).replace(/^[【\[][^】\]]+[】\]]\s*/, '');
    const label = trim(root.querySelector('.Zy_TItle > i')?.textContent) || String(i + 1);
    const t = marker.replace(/[【】\[\]]/g, '');
    let type = /判断|True or False|True\/False/i.test(t) ? 'true_false'
      : /多选|Multiple Select|Multiple Choice/i.test(t) ? 'multi_select'
      : /单选|Single Choice/i.test(t) ? 'single_select' : 'unknown';
    const listed = [...root.querySelectorAll('.Zy_ulTop li, .Py_tk li')];
    const options = listed.map((li, index) => ({
      value: trim(li.querySelector('.num_option, .before span, label')?.textContent) || String.fromCharCode(65+index),
      label: trim(li.querySelector('.after, a.fl, .fontLabel, .clearfix a')?.innerText ||
        li.querySelector('.after, a.fl, .fontLabel, .clearfix a')?.textContent ||
        li.innerText.replace(/^[A-Z]\s*/, '')),
    })).filter(o=>o.label).slice(0,10);
    const dataType = root.getAttribute('data');
    if (type === 'unknown' && dataType === '3') type = 'true_false';
    if (type === 'unknown' && dataType === '2') type = 'multi_select';
    if (type === 'unknown' && dataType === '1') type = 'single_select';
    if (!stem || !options.length) continue;
    questions.push({ number: label, type, stem, options });
  }
  return questions.slice(0,60);
}

export function detectObfuscatedText(question) {
  const all = [question.stem, ...(question.options || []).map(x=>x.label)].join(' ');
  // Chaoxing font-cxsecret uses nonstandard glyph substitutions (e.g. 嫴/嫯).
  // Fallback to manual verification rather than sending corrupted text to AI.
  const anomalous = (all.match(/[\u5A00-\u5B4F\uE000-\uF8FF]/g)||[]).length;
  return anomalous >= 2 || /[�]/.test(all);
}

export function normalizeQuizQuestions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0,60).map((q,i)=>({
    number: String(q.number || (i+1)).slice(0,8),
    type: ['single_select','multi_select','true_false'].includes(q.type) ? q.type : 'unknown',
    stem: String(q.stem || '').trim().slice(0,1600),
    options: Array.isArray(q.options) ? q.options.slice(0,10).map(x=>({
      value: String(x.value||'').trim().slice(0,5),
      label: String(x.label||'').trim().slice(0,600),
    })).filter(x=>x.value && x.label) : [],
  })).filter(q=>q.stem && q.options.length>=2).map(q=>({
    ...q,
    requiresManualCheck: detectObfuscatedText(q),
  }));
}
