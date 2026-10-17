import test from 'node:test';
import assert from 'node:assert/strict';
import { explainQuiz, DEEPSEEK_ENDPOINT, DEEPSEEK_MODEL } from '../src/quiz/provider.mjs';
import { extractQuizCards, scanQuizzes } from '../src/quiz/scan.mjs';

test('DeepSeek uses only Flash, non-thinking, bounded generation and no secrets in prompt', async () => {
  let count = 0;
  const fetchImpl = async (url, opts) => {
    count++;
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(url, DEEPSEEK_ENDPOINT);
    assert.equal(opts.method, 'POST');
    assert.equal(opts.headers.Authorization, 'Bearer fake-deepseek-key');
    const data = JSON.parse(opts.body);
    assert.equal(data.model, DEEPSEEK_MODEL);
    assert.equal(data.model, 'deepseek-flash');
    assert.deepEqual(data.thinking,{type:'disabled'});
    assert.equal(data.max_tokens,700);
    assert.equal(data.stream,false);
    assert.ok(!opts.body.includes('fake-deepseek-key'));
    assert.ok(!opts.body.includes('cookies.json'));
    assert.equal(data.messages.length,2);
    return { ok:true, text:async()=>JSON.stringify({
      choices:[{message:{content:'学习解析：根据课堂资料判断理由'}}],
      usage:{prompt_tokens:24,completion_tokens:17}
    }) };
  };
  const r=await explainQuiz({question:'解释机会成本的含义。', notes:'相关概念材料'}, {
    apiKey:'fake-deepseek-key',fetchImpl,
  });
  assert.equal(count,1);
  assert.equal(r.model,'deepseek-flash');
  assert.equal(r.provider,'DeepSeek');
  assert.equal(r.usage.inputTokens,24);
  assert.equal(r.usage.outputTokens,17);
});

test('DeepSeek rejects empty key, secret-bearing input, invalid responses and quota errors',async()=>{
  const options={apiKey:'fake-key'};
  await assert.rejects(explainQuiz({question:'Cookie: session=abc'},options),/疑似凭据/);
  await assert.rejects(explainQuiz({question:'DEEPSEEK_API_KEY=secret-secret'},options),/疑似凭据/);
  await assert.rejects(explainQuiz({question:''},options),/题干/);
  await assert.rejects(explainQuiz({question:'题目'}, {apiKey:''}),/DEEPSEEK_API_KEY/);
  await assert.rejects(explainQuiz({question:'题目'}, {...options,fetchImpl:async()=>({ok:false,status:402})}),/402/);
  await assert.rejects(explainQuiz({question:'题目'}, {...options,fetchImpl:async()=>({ok:false,status:429})}),/429/);
  await assert.rejects(explainQuiz({question:'题目'}, {...options,fetchImpl:async()=>({ok:true,text:async()=>'{x'})}),/JSON/);
});

test('quiz card parser reads only structural quiz metadata', () => {
  const html='<script>var mArg = '+JSON.stringify({attachments:[
    {type:'video',jobid:'video',isPassed:true,property:{name:'video'}},
    {type:'workid',jobid:'q1',isPassed:false,property:{title:'private prompt'}},
    {type:'workid',jobid:'q2',isPassed:true},
    {type:'document',jobid:'d1'},
  ]})+';</script>';
  const r=extractQuizCards(html,'p1',0);
  assert.equal(r.valid,true);
  assert.equal(r.tasks.length,2);
  assert.deepEqual(r.tasks.map(t=>t.status),['pending','confirmed']);
  assert.ok(!JSON.stringify(r).includes('private prompt'));
  assert.deepEqual(extractQuizCards('<html>login</html>','p1',0),{valid:false,tasks:[]});
});

test('read-only scanner never makes POST, deduplicates quiz tasks',async()=>{
  const requests=[];
  const html='<li><span id="cur101"></span><a class="clicktitle">一章一节</a><div class="knowledgeJobCount" value="2"></div></li>'+
             '<li><span id="cur102"></span><a class="clicktitle">一章二节</a><div class="knowledgeJobCount" value="1"></div></li>';
  const payload='<script>mArg = '+JSON.stringify({attachments:[{type:'workid',jobid:'job1',isPassed:false}]})+';</script>';
  const mockFetch=async(u,opts)=>{
    requests.push({url:String(u),opts});
    assert.equal(opts.method,'GET');
    assert.equal(opts.headers.Cookie,'test-cookie');
    return {status:200,text:async()=>String(u).includes('studentcourse')?html:payload};
  };
  const result=await scanQuizzes({course:{courseId:'11',clazzId:'22',cpi:'33'},
    cookie:'test-cookie',maxPoints:2,maxCards:3,fetchImpl:mockFetch});
  assert.equal(result.tasksFound,2);
  assert.equal(result.pending,2);
  assert.equal(result.scannedCards,6);
  assert.equal(requests.length,7);
  assert.equal(result.partialScan,true);
});
