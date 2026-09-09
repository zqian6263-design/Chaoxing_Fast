const stripTags = (s) => s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const attr = (html, name) => { const m = html.match(new RegExp(`${name}="([^"]*)"`)); return m ? m[1] : ''; };

/** 解析章节列表页 studentcourse，得到 [{id,title,jobCount,has_finished,need_unlock}] */
function decodeCoursePoint(html) {
  const points = [];
  const idRe = /id=["\x27]cur(\d+)["\x27]/g;
  let m;
  while ((m = idRe.exec(html)) !== null) {
    const id = m[1];
    const start = html.lastIndexOf('<li', m.index);
    const segStart = start >= 0 ? start : m.index;
    const endIdx = html.indexOf('</li>', m.index);
    const seg = endIdx >= 0 ? html.slice(segStart, endIdx + 5) : html.slice(segStart, segStart + 4000);
    const a = seg.match(/<a[^>]*class="[^"]*clicktitle[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const title = a ? stripTags(a[1]) : '';
    const jc = seg.match(/class="[^"]*knowledgeJobCount[^"]*"[^>]*value="(\d+)"/i);
    points.push({
      id,
      title: title || `知识点 ${id}`,
      jobCount: jc ? parseInt(jc[1], 10) : 1,
      has_finished: seg.includes('已完成'),
      need_unlock: seg.includes('解锁'),
    });
  }
  return points;
}

/** 从 HTML 中提取 mArg={...}; 里的对象（支持嵌套花括号） */
function extractMArg(html) {
  const m = html.match(/mArg\s*=\s*(\{)/);
  if (!m) return null;
  const open = m.index + m[0].length - 1; // "{"
  let depth = 0, j = open, inStr = false, esc = false;
  for (; j < html.length; j++) {
    const ch = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) break; }
    }
  }
  const raw = html.slice(open, j + 1);
  try { return JSON.parse(raw); } catch {
    try { return JSON.parse(raw.replace(/\s+/g, '')); } catch { return null; }
  }
}

/** 解析任务卡片页 knowledge/cards，得到 {jobs, info, notOpen} */
function decodeCourseCard(html) {
  if (html.includes('章节未开放')) return { jobs: [], info: {}, notOpen: true };
  const data = extractMArg(html);
  if (!data) return { jobs: [], info: {}, notOpen: false };

  const defaults = data.defaults || {};
  const info = {
    ktoken: defaults.ktoken || '', mtEnc: defaults.mtEnc || '', reportTimeInterval: defaults.reportTimeInterval || 60,
    defenc: defaults.defenc || '', cardid: defaults.cardid || '', cpi: defaults.cpi || '',
    qnenc: defaults.qnenc || '', knowledgeid: defaults.knowledgeid || '',
  };

  const jobs = [];
  for (const card of data.attachments || []) {
    if (card.isPassed) continue; // 已完成的任务直接跳过

    // 无 job 字段：可能是“阅读”任务
    if (card.job == null) {
      const prop = card.property || {};
      if (card.type === 'read' && !prop.read) {
        jobs.push({
          type: 'read', title: prop.title || '', id: prop.id || '', jobid: card.jobid || '',
          jtoken: card.jtoken || '', mid: card.mid || '', otherinfo: card.otherInfo || '',
          enc: card.enc || '', aid: card.aid || '',
        });
      }
      continue;
    }

    // 清理 otherInfo：只保留第一个 & 之前的部分（超星会附加冗余参数）
    const otherinfo = (card.otherInfo || '').split('&')[0];
    const prop = card.property || {};
    const cardType = (card.type || '').toLowerCase();
    const propType = (prop.type || '').toLowerCase();
    const resType = (prop.resourceType || '').toLowerCase();

    const isLive = /live/.test(cardType) || /live/.test(propType) || /live/.test(resType) ||
      prop.liveId != null || prop.streamName != null || prop.vdoid != null;

    if (isLive) {
      jobs.push({ type: 'live', jobid: card.jobid || String(card.id || ''), name: prop.title || prop.name || '未知直播', otherinfo, property: prop });
    } else if (cardType === 'video') {
      if (card.mid == null) { warn('遇到转码失败视频，已跳过'); continue; } // mid 缺失 = 转码失败
      jobs.push({
        type: 'video', jobid: card.jobid || '', name: prop.name || '', otherinfo,
        mid: card.mid, objectid: card.objectId || '', aid: card.aid || '',
        playTime: card.playTime || 0, rt: prop.rt || '',
        attDuration: card.attDuration || '', attDurationEnc: card.attDurationEnc || '',
        videoFaceCaptureEnc: card.videoFaceCaptureEnc || '',
      });
    } else if (cardType === 'document') {
      jobs.push({
        type: 'document', jobid: card.jobid || '', otherinfo, jtoken: card.jtoken || '',
        mid: card.mid || '', enc: card.enc || '', aid: card.aid || '',
        objectid: (prop.objectid || ''),
      });
    } else if (cardType === 'workid') {
      jobs.push({ type: 'workid', jobid: card.jobid || '', otherinfo, mid: card.mid || '', enc: card.enc || '', aid: card.aid || '' });
    } else {
      warn(`未知任务类型: ${cardType}，已跳过（原始: ${JSON.stringify(card).slice(0, 200)}）`);
    }
  }
  return { jobs, info, notOpen: false };
}

/* ============================== 业务逻辑 ============================== */
function resolveRt(job) {
  if (job.rt) return job.rt;
  const m = /-rt_([1d])/.exec(job.otherinfo || '');
  if (m) return m[1] === 'd' ? '0.9' : '1';
  return '';
}

/** enc 签名：与网页播放器一致 */
function calcEnc(clazzId, userid, jobid, objectId, playingTime, duration) {
  return md5(`[${clazzId}][${userid}][${jobid}][${objectId}][${playingTime * 1000}][d_yHJ!$pdA~5][${duration * 1000}][0_${duration}]`);
}

const warn = (m) => console.log('[警告] ' + m);

export { decodeCoursePoint, decodeCourseCard, calcEnc, resolveRt };
