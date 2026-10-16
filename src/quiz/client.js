const $ = (id) => document.getElementById(id);
const token = document.querySelector('meta[name="study-csrf"]').content;
const extracted = [];
function setText(id, text) { $(id).textContent = String(text); }
function add(tag, className, text) {
  const el=document.createElement(tag);
  if (className) el.className=className;
  if (text !== undefined) el.textContent=String(text);
  return el;
}
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
    setText('health', '本地服务在线 · '+status.provider+' · 模型 '+status.model+' · '+(status.enabled?'已允许手动请求':status.keyConfigured?'密钥已识别，待确认计费':'未配置密钥'));
    setText('key-status', status.enabled ? '已允许手动讲解（DeepSeek API 按量计费）' : status.environmentKeyAvailable ? '已找到系统环境变量中的密钥；勾选计费确认后启用，不必再次粘贴' : '尚未配置 DeepSeek API Key，请在本机页面配置');
    setText('explain-status', '本次会话已请求 '+status.used+' / '+status.sessionLimit);
  } catch(e) { setText('health', '服务不可用：'+e.message); }
}
function busy(button, state) { $(button).disabled = state; }
$('save-key').addEventListener('click', async () => {
  const apiKey = $('key').value.trim();
  busy('save-key', true);
  try { await jsonPost('/api/key',{apiKey,billingAcknowledged:$('billing-acknowledged').checked}); $('key').value=''; await health(); }
  catch(e){setText('key-status', e.message);}finally{busy('save-key',false);}
});
$('clear-key').addEventListener('click', async () => {
  try {await jsonPost('/api/clear-key', {});$('key').value='';$('billing-acknowledged').checked=false;await health();}
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

const typeLabel = {single_select:'单选题',multi_select:'多选题',true_false:'判断题',unknown:'题型待确认'};
const anomalous = text => (String(text).match(/[\u5A00-\u5B4F\uE000-\uF8FF]/g)||[]).length >= 2;
function fillQuestion(text) {
  if (anomalous(text)) {
    setText('question-status','检测到文字混淆：请先对照原网页或截图修正，再复制到 AI 输入框。');
    return;
  }
  $('question').value = text;
  $('question').scrollIntoView({behavior:'smooth',block:'center'});
  setText('question-status','已填写讲解输入框。不会自动调用 DeepSeek；请人工检查后点击生成。');
}
function quizText(q) {
  return '【'+(typeLabel[q.type]||'题型未知')+'】'+q.stem+'\n'+q.options.map(x=>x.value+'. '+x.label).join('\n');
}
function showQuestions(result) {
  extracted.length=0;
  $('question-cards').replaceChildren();
  setText('question-status','已从测验页面读取 '+result.total+' 道题目，其中 '+result.obfuscated+' 道含字体混淆；不会自动提交或发送到 AI。');
  for(const q of result.questions) {
    const card=add('div','quiz-question');
    const selectLabel=add('label','quiz-select');
    const box=add('input');box.type='checkbox';box.className='quiz-pick';
    selectLabel.append(box,document.createTextNode('第 '+q.number+' 题 · '+(typeLabel[q.type]||'未知题型')));
    card.append(selectLabel);
    if(q.requiresManualCheck) {
      card.append(add('div','warning','该题部分文字被平台字体混淆，需依据原网页/下方截图修正。未修正前不会传给 DeepSeek。'));
      if(typeof q.localPreview==='string' && q.localPreview.startsWith('data:image/png;base64,')) {
        const preview=add('img','preview');
        preview.src=q.localPreview;preview.alt='当前题目在本地 Chromium 中的可见截图，仅供人工核对';
        card.append(preview);
      }
    }
    const edit=add('textarea','quiz-edit');
    edit.rows=Math.min(10,Math.max(4,q.options.length+2));
    edit.maxLength=5000;edit.value=quizText(q);
    edit.setAttribute('aria-label','第 '+q.number+' 题可编辑文本');
    card.append(edit);
    const toInput=add('button','secondary','将此题放入讲解输入框');
    toInput.addEventListener('click',()=>fillQuestion(edit.value));
    card.append(toInput);
    $('question-cards').append(card);
    extracted.push({checkbox:box,textarea:edit});
  }
  $('question-cards').scrollIntoView({behavior:'smooth',block:'start'});
}
async function loadQuestions(pointId,cardNum,button) {
  button.disabled=true;
  setText('question-status','正在独立的只读浏览器中加载测验；不会填写或提交答案…');
  try {
    const result=await jsonPost('/api/questions',{pointId,cardNum});
    showQuestions(result);
  } catch(e) {setText('question-status','读取失败：'+e.message);}
  finally {button.disabled=false;}
}
$('batch-copy').addEventListener('click',()=>{
  const selected=extracted.filter(x=>x.checkbox.checked);
  if(!selected.length){setText('question-status','请先勾选需要学习的题目。');return;}
  if(selected.length>3){setText('question-status','一次最多选择 3 道题，避免占用过多 Token。');return;}
  fillQuestion(selected.map((q,i)=>'第 '+(i+1)+' 题\n'+q.textarea.value).join('\n\n'));
});
$('scan').addEventListener('click', async () => {
  busy('scan',true); $('tasks').replaceChildren();$('question-cards').replaceChildren();
  extracted.length=0;
  setText('scan-status','正在扫描，请勿重复点击…');
  try{
    const s = await jsonPost('/api/scan',{maxPoints:Number($('points').value),maxCards:Number($('cards').value)});
    setText('scan-status', '已扫描 '+s.scannedPoints+'/'+s.totalPoints+' 知识点、'+s.scannedCards+' 卡片；识别测验 '+s.tasksFound+' 项（平台确认 '+s.confirmed+'，待完成 '+s.pending+'，未知 '+s.unknown+'）；读取失败或无法解析 '+s.unresolvedCards+' 卡。'+(s.partialScan?' 当前为部分扫描，不代表未列出章节没有测验。':''));
    if (!s.results.length) {
      $('tasks').append(add('li','', '扫描范围内未识别到测验任务；不能据此断言整门课没有测验。'));
    }
    for(const item of s.results) {
      for (const task of item.quizzes) {
        const li=add('li','');
        li.append(document.createTextNode(item.title+' · '+task.type+'（'+(task.status==='confirmed'?'平台标记已完成':task.status==='pending'?'待完成':'未知')+'） '));
        const btn=add('button','secondary','读取题目');
        btn.addEventListener('click',()=>loadQuestions(item.pointId,task.cardNum,btn));
        li.append(btn);$('tasks').append(li);
      }
    }
  }catch(e){setText('scan-status','扫描失败：'+e.message);}
  finally{busy('scan',false);}
});
health();
