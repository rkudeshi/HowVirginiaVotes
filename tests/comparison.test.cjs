const {test}=require('node:test');
const assert=require('node:assert/strict');
const {choices,defaultReference,compare}=require('../dist/comparison.js');
const row=(date,total)=>({date,total,early:total*.8,mail:total*.2});
const locality=(id,registered,history)=>({id,registered,history});
const elections={
 '2024':{electionDate:'2024-11-05',localities:[]},
 '2025':{electionDate:'2025-11-04',localities:[locality('a',100,[row('2025-09-25',10),row('2025-09-26',20),row('2025-11-04',70),row('2025-11-05',75)])]},
 '2026-special':{electionDate:'2026-04-21',localities:[]},
 '2026':{electionDate:'2026-11-03',localities:[locality('a',200,[row('2026-09-25',60)])]}
};
test('defaults to prior November for both November and April 2026',()=>{
 assert.equal(defaultReference(elections,'2026'),'2025');
 assert.equal(defaultReference(elections,'2026-special'),'2025');
 assert.deepEqual(choices(elections,'2026'),['2026-special','2025','2024']);
 assert.equal(defaultReference(elections,'2024'),null);
});
test('matches election-relative dates and uses each election registration denominator',()=>{
 const r=compare(elections,'2026','2025',elections['2026'].localities);
 assert.equal(r.count,1);assert.equal(r.pairs[0].past.date,'2025-09-26');
 assert.equal(r.current.total,60);assert.equal(r.past.total,20);
 assert.ok(Math.abs(r.delta-10)<1e-9);
});
test('excludes missing localities from both totals, with explicit coverage',()=>{
 const rows=[...elections['2026'].localities,locality('missing',900,[row('2026-09-25',900)])];
 const r=compare(elections,'2026','2025',rows);
 assert.equal(r.eligible,2);assert.equal(r.count,1);assert.equal(r.current.registered,200);assert.equal(r.current.total,60);
});
test('does not extrapolate beyond the historical coverage',()=>{
 const r=compare(elections,'2026','2024',elections['2026'].localities);
 assert.equal(r.count,0);assert.equal(r.delta,null);
 const copy=structuredClone(elections);copy['2025'].localities[0].history=[row('2025-09-25',10)];
 assert.equal(compare(copy,'2026','2025',copy['2026'].localities).count,0);
});
test('caps completed elections at election day and preserves downward corrections',()=>{
 const rows=[locality('a',200,[row('2026-11-02',150),row('2026-11-03',140),row('2026-11-04',180)])];
 const r=compare(elections,'2026','2025',rows);
 assert.equal(r.pairs[0].dx,0);assert.equal(r.current.total,140);assert.equal(r.past.total,70);
 assert.equal(r.delta,0);
});
test('zero counts are real observations, missing early history is not zero',()=>{
 const copy=structuredClone(elections);copy['2025'].localities[0].history=[row('2025-09-26',0),row('2025-11-04',10)];
 assert.equal(compare(copy,'2026','2025',copy['2026'].localities).past.total,0);
 copy['2025'].localities[0].history=[row('2025-11-04',10)];
 assert.equal(compare(copy,'2026','2025',copy['2026'].localities).count,0);
});
test('regional turnout is weighted by registration, not the mean of local percentages',()=>{
 const copy=structuredClone(elections);copy['2026'].localities.push(locality('b',800,[row('2026-09-25',80)]));
 copy['2025'].localities.push(locality('b',900,[row('2025-09-26',90),row('2025-11-04',180)]));
 const r=compare(copy,'2026','2025',copy['2026'].localities);
 assert.equal(r.current.total,140);assert.equal(r.current.registered,1000);
 assert.ok(Math.abs(r.delta-3)<1e-9);
});
