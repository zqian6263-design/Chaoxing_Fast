import test from 'node:test';
import assert from 'node:assert/strict';
import { explainQuiz, GEMINI_ENDPOINT, GEMINI_MODEL } from '../src/quiz/provider.mjs';
import { extractQuizCards, scanQuizzes } from '../src/quiz/scan.mjs';

test('Gemini adapter sends only one POST to free-tier-eligible model, no secret in prompt', async () => {
  let count = 0;
  const fakeFetch = async (url, opts) => {
    count++;
    assert.equal(url, GEMINI_ENDPOINT);
    assert.equal(opts.method, 'POST');
    assert.equal(opts.headers['x-goog-api-key'], 'fake-google-key');
    assert.ok(!opts.body.includes('fake-google-key'));
    assert.ok(!opts.body.includes('cookies.json'));
    const body = JSON.parse(opts.body);
    assert.equal(body.contents.length, 1);
    assert.equal(body.contents[0].role, 'user');
    assert.equal(body.generationConfig.maxOutputTokens, 1400);
    return {ok:true, text:async()=>JSON.stringify({candidates:[{content:{parts:[{text:'本题主要考查机会成本的概念'},{text:'课程材料尚未提供'}]}}]})};
  };
  const result = await explainQuiz({question:'什么是机会成本？',notes:'请解释替代方案'}, {
    apiKey:'fake-google-key', fetchImpl:fakeFetch,
  });
  assert.equal(count,1);
  assert.equal(result.model, GEMINI_MODEL);
  assert.equal(result.provider, 'Google Gemini');
  assert.match(result.explanation, /课程材料尚未提供/);
  assert.match(GEMINI_ENDPOINT, /generativelanguage.googleapis.com\/v1beta\/models\/gemini-2.5-flash-lite:generateContent/);
});

test('Gemini provider fails closed for invalid inputs, forbidden secrets, quota, or safety blocks', async () => {
  const mock = {apiKey:'fake-google-key'};
  await assert.rejects(explainQuiz({question:'Cookie: session=abc'},mock),/疑似凭据/);
  await assert.rejects(explainQuiz({question:'AIzaFAKESECRET0123456789012345'},mock),/疑似凭据/);
  await assert.rejects(explainQuiz({question:' '},mock),/题干/);
  await assert.rejects(explainQuiz({question:'请解释原因'},{apiKey:''}),/Gemini API Key/);
  await assert.rejects(explainQuiz({question:'请解释原因'},{
    ...mock,fetchImpl:async()=>({ok:false,status:429,text:async()=>''}),
  }),/429/);
  await assert.rejects(explainQuiz({question:'请解释原因'},{
    ...mock,fetchImpl:async()=>({ok:false,status:403,text:async()=>''}),
  }),/403/);
  await assert.rejects(explainQuiz({question:'请解释原因'},{
    ...mock,fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify({candidates:[{finishReason:'SAFETY'}]})}),
  }),/安全策略/);
});

test('quiz card parser reads only structural quiz metadata', () => {
  const html='<script>var mArg = '+JSON.stringify({attachments:[
    {type:'video',jobid:'video',isPassed:true,property:{name:'video'}},
    {type:'workid',jobid:'q1',isPassed:false,property:{title:'secret prompt'}},
    {type:'workid',jobid:'q2',isPassed:true},
    {type:'document',jobid:'d1'},
  ]})+';</script>';
  const r=extractQuizCards(html,'p1',0);
  assert.equal(r.valid,true);
  assert.equal(r.tasks.length,2);
  assert.deepEqual(r.tasks.map(t=>t.status),['pending','confirmed']);
  assert.ok(!JSON.stringify(r).includes('secret prompt'));
  assert.deepEqual(extractQuizCards('<html>login</html>','p1',0),{valid:false,tasks:[]});
});

test('read-only course scanner never makes POST and deduplicates quiz tasks', async () => {
  const requests=[];
  const html='<li><span id="cur101"></span><a class="clicktitle">一章一节</a><div class="knowledgeJobCount" value="2"></div></li>'+
             '<li><span id="cur102"></span><a class="clicktitle">一章二节</a><div class="knowledgeJobCount" value="1"></div></li>';
  const payload='<script>mArg = '+JSON.stringify({attachments:[{type:'workid',jobid:'job1',isPassed:false}]})+';</script>';
  const mockFetch=async (u, opts) => {
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
  await assert.rejects(scanQuizzes({course:{courseId:'no',clazzId:'22',cpi:'33'},cookie:'test-cookie'}),/无效/);
});
