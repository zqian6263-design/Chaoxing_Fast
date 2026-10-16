/**
 * Read-only quiz task inventory. No submission or progress-report requests.
 * Course cookies remain on localhost, and questions are never auto-forwarded to AI.
 */
import { decodeCoursePoint, extractMArg } from '../parse.mjs';
import { readConfig, readCookieFile, cookieHeader, hasSession } from '../common.mjs';

const ORIGIN = 'https://mooc1.chaoxing.com';
const QUIZ_TYPES = new Set(['workid', 'work', 'quiz', 'test', 'exam']);

export function extractQuizCards(html, knowledgeid, num) {
  const data = extractMArg(html);
  if (!data || !Array.isArray(data.attachments)) return { valid: false, tasks: [] };
  const tasks = [];
  for (const [index, c] of data.attachments.entries()) {
    const type = String(c?.type || '').toLowerCase();
    if (!QUIZ_TYPES.has(type)) continue;
    tasks.push({
      knowledgeid: String(knowledgeid),
      cardNum: Number(num),
      taskKey: String(c.jobid || c.id || c.aid || c.workId || index),
      type,
      status: c.isPassed === true ? 'confirmed' : c.isPassed === false ? 'pending' : 'unknown',
      // Only safe structural metadata. Do not expose URLs, user IDs, tokens or answers.
    });
  }
  return { valid: true, tasks };
}

export async function scanQuizzes({
  course,
  cookie,
  maxPoints = 8,
  maxCards = 4,
  chapterNumber = null,
  onProgress = () => {},
  fetchImpl = fetch,
  pause = async () => {},
} = {}) {
  if (!course || !/^\d+$/.test(String(course.courseId || '')) ||
      !/^\d+$/.test(String(course.clazzId || '')) ||
      !/^\d+$/.test(String(course.cpi || ''))) throw new Error('课程配置无效');
  if (typeof cookie !== 'string' || !cookie.trim()) throw new Error('未检测到本地登录会话');
  if (!Number.isInteger(maxPoints) || maxPoints < 1 || maxPoints > 50 ||
      !Number.isInteger(maxCards) || maxCards < 1 || maxCards > 7)
    throw new Error('扫描范围必须为：知识点 1–50，每点卡片 1–7');

  async function request(host, pathname, params) {
    const url = new URL(pathname, host);
    for (const [key, val] of Object.entries(params)) url.searchParams.set(key, String(val));
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Cookie: cookie, Accept: 'text/html' },
      signal: AbortSignal.timeout(12000),
      redirect: 'manual',
    });
    if (response.status !== 200) throw new Error('读取课程信息失败，HTTP ' + response.status);
    const body = await response.text();
    if (body.length > 2_000_000) throw new Error('课程页面超过扫描长度限制');
    return body;
  }

  const chapters = await request('https://mooc2-ans.chaoxing.com', '/mooc2-ans/mycourse/studentcourse', {
    courseid: course.courseId, clazzid: course.clazzId, cpi: course.cpi, ut: 's',
  });
  const allPoints = decodeCoursePoint(chapters);
  if (!allPoints.length) throw new Error('未解析到章节，请检查登录会话或页面格式');
  const selected = chapterNumber === null ? allPoints : allPoints.filter(p => {
    const match = /^\s*(\d+)\./.exec(p.title);
    return match && Number(match[1]) === chapterNumber;
  });
  if (chapterNumber !== null && (!Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > 99))
    throw new Error('章节号必须为 1–99 的整数');
  if (!selected.length) throw new Error('该章节无可识别知识点，请检查章节编号');
  const points = selected.slice(0, maxPoints);
  const results = [];
  let unknownCards = 0;
  let cardErrors = 0;
  let inspected = 0;
  for (const p of points) {
    const jobs = new Map();
    for (let num = 0; num < maxCards; num++) {
      await pause();
      try {
        const html = await request(ORIGIN, '/mooc-ans/knowledge/cards', {
          clazzid: course.clazzId, courseid: course.courseId, knowledgeid: p.id,
          ut: 's', cpi: course.cpi, v: '2025-0424-1038-3', mooc2: 1, num,
        });
        const result = extractQuizCards(html, p.id, num);
        if (!result.valid) { unknownCards++; continue; }
        for (const job of result.tasks) {
          // Job ID may be reused across cards; only count once per knowledge point.
          const key = p.id + ':' + job.taskKey;
          if (!jobs.has(key)) jobs.set(key, job);
          else if (jobs.get(key).status === 'unknown' && job.status !== 'unknown') jobs.set(key, job);
        }
      } catch {
        cardErrors++;
      }
    }
    if (jobs.size) results.push({ pointId: p.id, title: p.title, quizzes: [...jobs.values()] });
    inspected++;
    onProgress({inspected,total:points.length,title:p.title,tasksFound:results.reduce((s,r)=>s+r.quizzes.length,0)});
  }
  const tasks = results.flatMap(p => p.quizzes);
  return {
    scannedPoints: points.length,
    totalPoints: selected.length,
    cardsPerPoint: maxCards,
    scannedCards: points.length * maxCards,
    unresolvedCards: unknownCards + cardErrors,
    tasksFound: tasks.length,
    confirmed: tasks.filter(t => t.status === 'confirmed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    unknown: tasks.filter(t => t.status === 'unknown').length,
    partialScan: points.length < selected.length || maxCards < 7 || unknownCards > 0 || cardErrors > 0,
    results,
  };
}

export async function scanConfiguredCourse(args = {}) {
  const { course } = readConfig();
  const cookies = readCookieFile();
  if (!hasSession(cookies)) throw new Error('未登录，请先在原项目完成超星登录');
  return scanQuizzes({ course, cookie: cookieHeader(cookies), ...args });
}
