import { randomUUID } from 'node:crypto';
import { MAX_BATCHES, BATCH_SIZE } from './batch.mjs';

export function createChapterRunner({scan,read,analyze,acquireSlot}){
  let active=null;
  function snapshot(){
    if(!active)return {state:'idle'};
    const {pendingQuestions,...other}=active;
    return JSON.parse(JSON.stringify(other));
  }
  function start({chapterNumber=1,maxPoints=50,maxCards=3}={}){
    if(active?.state==='running')throw Object.assign(new Error('已有整章解析任务正在执行'),{status:409});
    if(!Number.isInteger(chapterNumber)||chapterNumber<1||chapterNumber>99||
       !Number.isInteger(maxPoints)||maxPoints<1||maxPoints>50||
       !Number.isInteger(maxCards)||maxCards<1||maxCards>7)
      throw Object.assign(new Error('章节号或扫描范围无效'),{status:400});
    const job={id:randomUUID(),state:'running',phase:'scan',chapterNumber,
      message:'正在扫描该章节测验…',scanned:0,totalPoints:0,foundTasks:0,readTasks:0,
      foundQuestions:0,processedQuestions:0,modelRequests:0,limitRequests:MAX_BATCHES,
      truncated:false,failures:[],results:[],startedAt:new Date().toISOString(),finishedAt:null,
      pendingQuestions:[],cancelled:false};
    active=job;
    void execute(job,maxPoints,maxCards).catch(e=>{
      if(active!==job)return;
      job.state=job.cancelled?'cancelled':'failed';
      job.phase='done';job.message=job.cancelled?'用户已终止批处理':'失败：'+String(e.message||'未知错误').slice(0,180);
      job.finishedAt=new Date().toISOString();job.pendingQuestions=[];
    });
    return snapshot();
  }
  function cancel(id){
    if(!active||id!==active.id||active.state!=='running')throw Object.assign(new Error('没有可取消的批处理'),{status:404});
    active.cancelled=true;active.message='正在结束当前步骤；已禁止启动新的模型请求';
    return snapshot();
  }
  async function execute(job,maxPoints,maxCards){
    const inventory=await scan({
      chapterNumber:job.chapterNumber,maxPoints,maxCards,
      onProgress:p=>{if(job.cancelled)throw new Error('用户已取消扫描');
        job.scanned=p.inspected;job.totalPoints=p.total;job.foundTasks=p.tasksFound;
        job.message='扫描知识点 '+p.inspected+'/'+p.total+'（'+p.title.slice(0,50)+'）';}
    });
    job.scanned=inventory.scannedPoints;
    job.totalPoints=inventory.totalPoints;
    job.foundTasks=inventory.tasksFound;
    if(inventory.partialScan)job.failures.push('章节扫描可能不完整，无法据此断言所有测验均已识别');
    const allTasks=inventory.results.flatMap(x=>x.quizzes.map(q=>({...q,pointId:x.pointId,pointTitle:x.title}))).filter(q=>q.status!=='confirmed');
    const maxTasks=15;
    if(allTasks.length>maxTasks){job.truncated=true;job.failures.push('超过每轮 15 个测验任务的读取上限，其余未处理');}
    const queue=allTasks.slice(0,maxTasks);
    job.phase='read';
    for(const [idx,task] of queue.entries()){
      if(job.cancelled)break;
      job.message='读取测验 '+(idx+1)+'/'+queue.length+'：'+task.pointTitle.slice(0,50);
      try{
        const info=await read({pointId:task.pointId,cardNum:task.cardNum});
        job.readTasks++;
        for(const [i,q] of info.questions.entries()){
          if(job.pendingQuestions.length >= MAX_BATCHES * BATCH_SIZE){
            job.truncated=true;break;
          }
          const id='p'+idx+'-q'+i;
          const question={...q,id,pointTitle:task.pointTitle};
          job.foundQuestions++;
          if(!['single_select','multi_select','true_false'].includes(question.type)){
            job.results.push({id,pointTitle:task.pointTitle,number:q.number,stem:q.stem,
              suggested:[],confidence:'low',warning:'题型未知，跳过模型调用',reason:'',source:'未确认'});
          }else if(question.requiresManualCheck && !question.localPreview){
            job.results.push({id,pointTitle:task.pointTitle,number:q.number,stem:q.stem,
              suggested:[],confidence:'low',warning:'字体混淆且截图缺失，跳过模型调用',reason:'',source:'未确认'});
          }else{job.pendingQuestions.push(question);}
        }
      }catch(e){job.failures.push((task.pointTitle+'：'+String(e.message||'题目读取失败')).slice(0,170));}
    }
    if(job.cancelled){job.state='cancelled';job.phase='done';job.finishedAt=new Date().toISOString();job.pendingQuestions=[];return;}
    job.phase='analyze';
    const total=job.pendingQuestions.length;
    for(let offset=0;offset<total;offset+=BATCH_SIZE){
      if(job.cancelled)break;
      const group=job.pendingQuestions.slice(offset,offset+BATCH_SIZE);
      job.message='DeepSeek Flash 分析第 '+(job.modelRequests+1)+'/'+Math.ceil(total/BATCH_SIZE)+' 批（'+group.length+' 题）';
      // acquireSlot increments shared request counter before an actual billed call.
      if(!acquireSlot()){
        job.truncated=true;job.failures.push('模型请求配额已达到本地限额；剩余题目未调用');break;
      }
      job.modelRequests++;
      try{
        const response=await analyze(group);
        job.results.push(...response.items);
        job.processedQuestions+=group.length;
      }catch(e){
        job.failures.push('第 '+job.modelRequests+' 批：'+String(e.message||'模型错误').slice(0,160));
        job.results.push(...group.map(q=>({id:q.id,pointTitle:q.pointTitle,number:q.number,stem:q.stem,
          suggested:[],confidence:'low',reason:'',warning:'API 批次失败，未生成建议',source:'未确认'})));
      }
    }
    job.pendingQuestions=[];
    job.state=job.cancelled?'cancelled':'completed';
    job.phase='done';
    job.message=job.cancelled?'已取消，已保留当前结果':
      '解析流程结束：'+job.processedQuestions+' 道题已请求模型；'+job.failures.length+' 项提醒';
    job.finishedAt=new Date().toISOString();
  }
  return {start,snapshot,cancel};
}
