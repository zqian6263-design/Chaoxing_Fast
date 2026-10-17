import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBatch,parseBatchResponse,analyzeBatch} from '../src/quiz/batch.mjs';
import {createChapterRunner} from '../src/quiz/pipeline.mjs';

const questions=[
 {id:'p0-q0',pointTitle:'1.1',number:'1',type:'multi_select',stem:'什么是创业准备？',
 options:[{value:'A',label:'时间'},{value:'B',label:'资金'},{value:'C',label:'策略'}],requiresManualCheck:false},
 {id:'p0-q1',pointTitle:'1.1',number:'2',type:'true_false',stem:'创嫴嫯嫳的概念',
 options:[{value:'A',label:'对'},{value:'B',label:'错'}],requiresManualCheck:true,
 localPreview:'data:image/png;base64,'+Buffer.from('fakepng').toString('base64')},
];

test('DeepSeek multimodal request contains screenshot and JSON instructions but no API key',async()=>{
 const {parts,accepted}=prepareBatch(questions);
 assert.equal(parts.filter(x=>x.type==='image_url').length,1);
 assert.equal(parts.filter(x=>x.type==='image_url')[0].image_url.detail,'original');
 assert.ok(!JSON.stringify(parts).includes('创嫴'));
 assert.equal(accepted.length,2);
 let called=0;
 const mockFetch=async(url,opts)=>{
  called++;
  assert.equal(url,'https://api.deepseek.com/chat/completions');
  assert.equal(opts.headers.Authorization,'Bearer not-a-real-key');
  const data=JSON.parse(opts.body);
  assert.equal(data.model,'deepseek-flash');
  assert.deepEqual(data.response_format,{type:'json_object'});
  assert.equal(data.messages[1].content.length,3);
  assert.ok(!opts.body.includes('not-a-real-key'));
  return {ok:true,text:async()=>JSON.stringify({choices:[{message:{content:JSON.stringify({
    items:[{id:'p0-q0',stem:'什么是创业准备？',suggested:['A','B'],reason:'应评估多类资源',confidence:'medium',warning:''},
      {id:'p0-q1',stem:'创业需要规划。',suggested:['A'],reason:'从资源角度理解',confidence:'low',warning:''}]
  })}}],usage:{prompt_tokens:111,completion_tokens:99}})};
 };
 const response=await analyzeBatch(questions,{apiKey:'not-a-real-key',fetchImpl:mockFetch});
 assert.equal(called,1);
 assert.equal(response.items.length,2);
 assert.deepEqual(response.items[0].suggested,['A','B']);
 assert.deepEqual(response.items[1].suggested,['A']);
 assert.equal(response.usage.outputTokens,99);
});

test('model schema validator rejects foreign question IDs, bad choices, missing and duplicate IDs',()=>{
 const one=[questions[0]];
 assert.throws(()=>parseBatchResponse(JSON.stringify({items:[{id:'fake',suggested:['A']}]}),one),/未知或重复/);
 assert.throws(()=>parseBatchResponse(JSON.stringify({items:[{id:'p0-q0'},{id:'p0-q0'}]}),one),/未知或重复/);
 const invalid=parseBatchResponse(JSON.stringify({items:[{id:'p0-q0',stem:'问题',suggested:['Z'],confidence:'high'}]}),one);
 assert.deepEqual(invalid[0].suggested,[]);
 assert.equal(invalid[0].confidence,'low');
 const missing=parseBatchResponse(JSON.stringify({items:[]}),one);
 assert.equal(missing[0].confidence,'low');
 assert.deepEqual(missing[0].suggested,[]);
});

test('runner discovers tasks then batches exactly once, caps calls and does not submit',async()=>{
 let getCalls=0,readCalls=0,aiCalls=0;
 const runner=createChapterRunner({
  scan:async opts=>{getCalls++;assert.equal(opts.chapterNumber,1); opts.onProgress({inspected:1,total:1,title:'1.1',tasksFound:1});
    return {scannedPoints:1,totalPoints:1,tasksFound:1,partialScan:false,results:[
      {pointId:'101',title:'1.1',quizzes:[{cardNum:1,type:'workid'}]}]};},
  read:async opts=>{readCalls++;assert.equal(opts.cardNum,1);return {questions:[
    {number:'1',type:'true_false',stem:'是否需要规划？',options:[{value:'A',label:'对'},{value:'B',label:'错'}],requiresManualCheck:false}
  ]};},
  analyze:async q=>{aiCalls++;return {items:[{id:q[0].id,stem:q[0].stem,number:'1',type:'true_false',pointTitle:'1.1',
   suggested:['A'],confidence:'medium',reason:'需要事先评估',source:'AI 建议'}]};},
  acquireSlot:()=>true,
 });
 runner.start({chapterNumber:1});
 await new Promise(r=>setTimeout(r,20));
 const status=runner.snapshot();
 assert.equal(status.state,'completed');
 assert.equal(status.processedQuestions,1);
 assert.equal(status.modelRequests,1);
 assert.equal(status.results.length,1);
 assert.equal(getCalls,1);assert.equal(readCalls,1);assert.equal(aiCalls,1);
 assert.throws(()=>runner.start({chapterNumber:0}),/章节号/);
});


test('runner enforces five requests and twenty questions even if a quiz contains more',async()=>{
 let apiRequests=0;
 const many=Array.from({length:35},(_,i)=>({number:String(i+1),type:'true_false',stem:'这是模拟断言'+i,
  options:[{value:'A',label:'对'},{value:'B',label:'错'}],requiresManualCheck:false}));
 const runner=createChapterRunner({
  scan:async()=>({scannedPoints:1,totalPoints:1,tasksFound:1,partialScan:false,
    results:[{pointId:'100',title:'1.1',quizzes:[{cardNum:1,status:'unknown'}]}]}),
  read:async()=>({questions:many}),
  acquireSlot:()=>{apiRequests++;return true;},
  analyze:async group=>({items:group.map(q=>({id:q.id,number:q.number,pointTitle:q.pointTitle,
    stem:q.stem,type:q.type,suggested:['A'],confidence:'low',reason:'模拟'}))}),
 });
 runner.start({chapterNumber:1});
 await new Promise(r=>setTimeout(r,30));
 const state=runner.snapshot();
 assert.equal(state.state,'completed');
 assert.equal(state.truncated,true);
 assert.equal(state.processedQuestions,20);
 assert.equal(state.modelRequests,5);
 assert.equal(apiRequests,5);
 assert.equal(state.results.length,20);
});

test('runner refuses simultaneous jobs and cancel prevents model calls',async()=>{
 let release;
 const runner=createChapterRunner({
   scan:()=>new Promise(r=>{release=r;}),
   read:async()=>{throw Error('read should be skipped after cancellation');},
   analyze:async()=>{throw Error('must not analyze');},
   acquireSlot:()=>{throw Error('must not allocate budget');},
 });
 const job=runner.start({chapterNumber:1});
 assert.throws(()=>runner.start({chapterNumber:1}),/正在执行/);
 runner.cancel(job.id);
 release({scannedPoints:0,totalPoints:1,tasksFound:0,partialScan:false,results:[]});
 await new Promise(r=>setTimeout(r,20));
 assert.equal(runner.snapshot().state,'cancelled');
 assert.equal(runner.snapshot().modelRequests,0);
});
