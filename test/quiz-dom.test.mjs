import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQuizQuestions,detectObfuscatedText} from '../src/quiz/dom.mjs';
import {makeCardUrl} from '../src/quiz/reader.mjs';
import {explainQuiz} from '../src/quiz/provider.mjs';

test('real-type fixture detects judgment, choice and obfuscated characters without answer keys',()=>{
 const questions=normalizeQuizQuestions([
  {number:'1',type:'true_false',stem:'创业是一种实践活动。',options:[{value:'A',label:'对'},{value:'B',label:'错'}]},
  {number:'2',type:'multi_select',stem:'创业前应评估哪些资源？',options:[{value:'A',label:'时间'},{value:'B',label:'能力'},{value:'C',label:'资金'}]},
  {number:'3',type:'true_false',stem:'创嫴是嫯嫳嫮关民族嫵国家的嫭嫮。',options:[{value:'A',label:'对'},{value:'B',label:'错'}]},
 ]);
 assert.equal(questions.length,3);
 assert.deepEqual(questions.map(q=>q.type),['true_false','multi_select','true_false']);
 assert.deepEqual(questions.map(q=>q.requiresManualCheck),[false,false,true]);
 assert.equal(questions[1].options.length,3);
 assert.ok(!JSON.stringify(questions).includes('answerKey'));
 assert.equal(detectObfuscatedText({stem:'测试正常文字',options:[]}),false);
});
test('normalizer does not invent choices, keys or statuses for incomplete DOM',()=>{
 const r=normalizeQuizQuestions([{type:'unknown',stem:'示例',options:[{value:'A',label:'甲'}]},
    {type:'unknown',stem:'示例二',options:[{value:'A',label:'甲'},{value:'B',label:'乙'}]}]);
 assert.equal(r.length,1);
 assert.equal(r[0].type,'unknown');
 assert.deepEqual(Object.keys(r[0]).sort(),['number','type','stem','options','requiresManualCheck'].sort());
});
test('task card URL accepts only numeric identifiers and a bounded card index',()=>{
 const c={courseId:'1234',clazzId:'5678',cpi:'9012'};
 const url=new URL(makeCardUrl(c,'543210',1));
 assert.equal(url.hostname,'mooc1.chaoxing.com');
 assert.equal(url.searchParams.get('knowledgeid'),'543210');
 assert.equal(url.searchParams.get('num'),'1');
 assert.throws(()=>makeCardUrl(c,'http://localhost:99',1),/ID/);
 assert.throws(()=>makeCardUrl(c,'543210',7),/序号/);
 assert.throws(()=>makeCardUrl({courseId:'1',clazzId:'bad',cpi:'3'},'543210',0),/配置/);
});
test('cannot send obfuscated quiz text to DeepSeek',async()=>{
 let calls=0;
 await assert.rejects(explainQuiz({question:'创嫴是嫯嫳嫮关民族嫵国家的嫭嫮。'},{
 apiKey:'fake-test-key',fetchImpl:async()=>{calls++;throw Error('Must not call API');}
 }),/字体混淆/);
 assert.equal(calls,0);
});
