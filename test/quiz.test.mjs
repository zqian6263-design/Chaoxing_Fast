import test from 'node:test';
import assert from 'node:assert/strict';
import { explainQuiz, ZEN_ENDPOINT, FREE_ZEN_MODEL } from '../src/quiz/provider.mjs';
import { extractQuizCards, scanQuizzes } from '../src/quiz/scan.mjs';

test('provider accepts only explicitly declared free model, never leaks Cookie or keys into prompt', async () => {
  let calls = 0;
  const fetchImpl = async (url, request) => {
    calls++;
    assert.equal(url, ZEN_ENDPOINT);
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.Authorization, 'Bearer test-secret-key');
    const data = JSON.parse(request.body);
    assert.equal(data.model, FREE_ZEN_MODEL);
    assert.equal(data.messages.length, 2);
    assert.ok(!request.body.includes('test-secret-key'));
    assert.ok(!request.body.includes('cookies.json'));
    assert.equal(data.stream, false);
    return {ok:true, text:async()=>JSON.stringify({choices:[{message:{content:'应先理解概念，并根据课程材料核对。'}}]})};
  };
  const result = await explainQuiz({question:'以下哪个陈述符合课堂定义？\nA.甲\nB.乙'},
    {apiKey:'test-secret-key',fetchImpl});
  assert.equal(result.model, FREE_ZEN_MODEL);
  assert.match(result.explanation, /概念/);
  assert.equal(calls,1);
});
test('provider fails closed on credential-looking questions and malformed data', async () => {
  await assert.rejects(explainQuiz({question:'Cookie: session=hello'}, {apiKey:'test-secret-key'}), /疑似凭据/);
  await assert.rejects(explainQuiz({question:' '}, {apiKey:'test-secret-key'}), /题干/);
  await assert.rejects(explainQuiz({question:'请解释原因'}, {apiKey:''}), /API Key/);
  await assert.rejects(explainQuiz({question:'请解释原因'}, {apiKey:'test-secret-key',
    fetchImpl:async()=>({ok:false,status:429,text:async()=>''})}), /429/);
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
  await assert.rejects(scanQuizzes({course:{courseId:'no',clazzId:'22',cpi:'33'},cookie:'test-cookie'}), /无效/);
});
