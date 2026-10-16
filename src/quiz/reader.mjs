import '../runtime.mjs';
import { chromium } from 'playwright';
import { readConfig, readCookieFile, hasSession } from '../common.mjs';
import { extractQuestionsFromPage, normalizeQuizQuestions } from './dom.mjs';

export function makeCardUrl(course, pointId, cardNum) {
  if (!course || !/^\d+$/.test(String(course.courseId||'')) ||
    !/^\d+$/.test(String(course.clazzId||'')) ||
    !/^\d+$/.test(String(course.cpi||''))) throw new Error('课程配置无效');
  if (!/^\d{1,15}$/.test(String(pointId||''))) throw new Error('知识点 ID 无效');
  if (!Number.isInteger(cardNum) || cardNum < 0 || cardNum > 6) throw new Error('任务卡序号无效');
  const u = new URL('https://mooc1.chaoxing.com/mooc-ans/knowledge/cards');
  for (const [k,v] of Object.entries({
    clazzid: course.clazzId,courseid: course.courseId,knowledgeid:pointId,
    ut:'s',cpi:course.cpi,v:'2025-0424-1038-3',mooc2:1,num:cardNum,
  })) u.searchParams.set(k,String(v));
  return u.toString();
}

/**
 * Opens only one lesson card in a SEPARATE, temporary Chromium context.
 * All non-GET/HEAD requests are blocked, including form submissions.
 * No answer controls are touched, and no cookie/profile files are modified.
 */
export async function readQuizQuestions({pointId,cardNum,timeoutMs=20000}={}) {
  const {course}=readConfig();
  const url=makeCardUrl(course,pointId,cardNum);
  const cookies=readCookieFile();
  if(!hasSession(cookies)) throw new Error('学习通会话不存在或已失效');
  const browser=await chromium.launch({headless:true});
  try {
    const context=await browser.newContext({viewport:{width:1200,height:850}});
    await context.route('**/*', route=>{
      const method=route.request().method();
      return method==='GET' || method==='HEAD' ? route.continue() : route.abort();
    });
    await context.addCookies(cookies.filter(c=>c.domain && c.name && c.value).map(c=>({
      name:c.name,value:c.value,domain:c.domain,path:c.path||'/',
    })));
    const page=await context.newPage();
    page.on('dialog',dialog=>dialog.dismiss().catch(()=>{}));
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:timeoutMs});
    if(!response || response.status()!==200) throw new Error('知识点页面无法打开');
    let workFrame;
    const start=Date.now();
    while(Date.now()-start < timeoutMs) {
      for(const frame of page.frames()) {
        if(!frame.url().includes('/work/doHomeWorkNew')) continue;
        const count=await frame.locator('.TiMu').count().catch(()=>0);
        if(count>0) {workFrame=frame;break;}
      }
      if(workFrame) break;
      await page.waitForTimeout(450);
    }
    if(!workFrame) throw new Error('当前任务卡未找到可读取的章节测验，请确认选择的是 workid 测验卡');
    const raw=await workFrame.evaluate(extractQuestionsFromPage);
    const questions=normalizeQuizQuestions(raw);
    if(!questions.length) throw new Error('找到了测验框架，但未识别到完整的题干与选项');
    // A local screenshot is a safe fallback for font-cxsecret obfuscation:
    // Chromium draws the original visible glyphs; no OCR or third-party upload.
    const elements=workFrame.locator('.TiMu.newTiMu');
    for (let i=0;i<Math.min(questions.length,8);i++) {
      if(!questions[i].requiresManualCheck || i >= await elements.count()) continue;
      try {
        const image=await elements.nth(i).screenshot({type:'png',timeout:8000,animations:'disabled'});
        if(image.byteLength<=280000) questions[i].localPreview='data:image/png;base64,'+image.toString('base64');
      } catch { /* show text warning if screenshot is unavailable */ }
    }
    return {
      pointId:String(pointId), cardNum, total:questions.length,
      obfuscated:questions.filter(q=>q.requiresManualCheck).length,
      questions,
      note:'只读提取；检测到字体混淆时请在网页上人工核对，不要直接发送乱码给 AI。',
    };
  } finally { await browser.close(); }
}
