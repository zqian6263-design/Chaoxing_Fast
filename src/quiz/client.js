const $ = (id) => document.getElementById(id);
const token = document.querySelector('meta[name="study-csrf"]').content;
function setText(id, text) { $(id).textContent = String(text); }
async function jsonPost(url, body) {
  const response = await fetch(url, {method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','X-Study-CSRF': token},
    body: JSON.stringify(body)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || ('HTTP '+response.status));
  return data;
}
async function health() {
  try {
    const response = await fetch('/api/health', {cache:'no-store'});
    const status = await response.json();
    setText('health', '本地服务在线 · '+status.provider+' · 免费层可用模型 '+status.model+' · '+(status.keyConfigured?'密钥已配置':'未配置密钥'));
    setText('key-status', status.keyConfigured ? '已在本次会话启用密钥（不会显示或保存）；Free tier 由用户确认，程序无法验证账单归属' : '尚未配置 Gemini API Key；请先确认项目为 Free tier');
    setText('explain-status', '本次会话已请求 '+status.used+' / '+status.sessionLimit);
  } catch(e) { setText('health', '服务不可用：'+e.message); }
}
function busy(button, state) { $(button).disabled = state; }
$('save-key').addEventListener('click', async () => {
  const apiKey = $('key').value.trim();
  busy('save-key', true);
  try { await jsonPost('/api/key',{apiKey,freeTierConfirmed:$('free-tier-confirmed').checked}); $('key').value=''; await health(); }
  catch(e){setText('key-status', e.message);}finally{busy('save-key',false);}
});
$('clear-key').addEventListener('click', async () => {
  try {await jsonPost('/api/clear-key', {});$('key').value='';$('free-tier-confirmed').checked=false;await health();}
  catch(e){setText('key-status',e.message);}
});
$('explain').addEventListener('click', async () => {
  busy('explain',true);setText('answer','正在生成学习解释…');
  try {
    const result = await jsonPost('/api/explain',{question:$('question').value, notes:$('notes').value});
    setText('answer',result.explanation);
  }catch(e){setText('answer','无法生成讲解：'+e.message);}
  finally{busy('explain',false); await health();}
});
$('scan').addEventListener('click', async () => {
  busy('scan',true); $('tasks').replaceChildren();setText('scan-status','正在扫描，请勿重复点击…');
  try{
    const s = await jsonPost('/api/scan',{maxPoints:Number($('points').value),maxCards:Number($('cards').value)});
    setText('scan-status', '已扫描 '+s.scannedPoints+'/'+s.totalPoints+' 知识点、'+s.scannedCards+' 卡片；识别测验 '+s.tasksFound+' 项（平台确认 '+s.confirmed+'，待完成 '+s.pending+'，未知 '+s.unknown+'）；读取失败或无法解析 '+s.unresolvedCards+' 卡。'+(s.partialScan?' 当前为部分扫描，不代表未列出章节没有测验。':''));
    if (!s.results.length) {
      const li = document.createElement('li');li.textContent='扫描范围内未识别到测验任务；不能据此断言整门课没有测验。';$('tasks').append(li);
    }
    for(const item of s.results) {
      const li=document.createElement('li');
      const status=item.quizzes.map(x => x.type+': '+(x.status==='confirmed'?'平台标记已完成':x.status==='pending'?'待完成':'未知')).join('，');
      li.textContent=item.title+'（'+item.quizzes.length+' 项）— '+status;
      $('tasks').append(li);
    }
  }catch(e){setText('scan-status','扫描失败：'+e.message);}
  finally{busy('scan',false);}
});
health();
