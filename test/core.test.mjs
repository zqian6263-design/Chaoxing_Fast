import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { decodeCoursePoint, decodeCourseCard, calcEnc, getVideoCompletion } from '../src/parse.mjs';
import { courseFromUrl, hasSession } from '../src/common.mjs';

const job = { jobid: 'j-42', objectid: 'obj-42' };
function card(isPassed) {
  return '<script>var mArg = ' + JSON.stringify({
    defaults: {},
    attachments: [{type:'video', job:'job', jobid:job.jobid, objectId:job.objectid, mid:'abc', property:{name:'Video A'}, isPassed}]
  }) + ';</script>';
}

test('signing function does not crash and uses stable input', () => {
  const actual = calcEnc('c', 'u', 'j', 'o', 12, 60);
  const data = '[c][u][j][o][12000][d_yHJ!$pdA~5][60000][0_60]';
  assert.equal(actual, crypto.createHash('md5').update(data).digest('hex'));
});
test('task completion follows the actual server flag', () => {
  assert.equal(getVideoCompletion(card(false), job), 'pending');
  assert.equal(getVideoCompletion(card(true), job), 'confirmed');
  assert.equal(getVideoCompletion('<html>login</html>', job), 'unknown');
  assert.equal(getVideoCompletion(card(true), {jobid:'other',objectid:'other'}), 'unknown');
});
test('card parser only lists pending video tasks', () => {
  assert.equal(decodeCourseCard(card(false)).jobs.length, 1);
  assert.equal(decodeCourseCard(card(true)).jobs.length, 0);
});
test('chapter parser reads example HTML', () => {
  const html='<li><span id="cur123"></span><a class="clicktitle">Lesson A</a><div class="knowledgeJobCount" value="2"></div></li>';
  const points=decodeCoursePoint(html);
  assert.equal(points.length,1);
  assert.equal(points[0].id,'123');
  assert.equal(points[0].title,'Lesson A');
});
test('course URL validation', () => {
  assert.equal(courseFromUrl('https://example.invalid/?courseid=1&clazzid=2&cpi=3').courseId,'1');
  assert.equal(courseFromUrl('https://example.invalid/?courseid=1&clazzid=2'),null);
});
test('session excludes expired cookies', () => {
  assert.equal(hasSession([{name:'_uid',value:'u',expires:Math.floor(Date.now()/1000)-100}]),false);
  assert.equal(hasSession([{name:'_uid',value:'u',expires:Math.floor(Date.now()/1000)+300}]),true);
  assert.equal(hasSession([{name:'_uid',value:'u',expires:-1}]),true);
  assert.equal(hasSession([{name:'_uid',value:''}]),false);
});
