const {test}=require('node:test');
const assert=require('node:assert/strict');
const {choices,references,defaultReference,compare,aggregateHistories,dayLabels}=require('../dist/comparison.js');
const row=(date,total)=>({date,total,early:total*.8,mail:total*.2});
const locality=(id,registered,history)=>({id,registered,history});
const elections={
 '2024':{electionDate:'2024-11-05',localities:[]},
 '2025':{electionDate:'2025-11-04',localities:[locality('a',100,[row('2025-09-25',10),row('2025-09-26',20),row('2025-11-04',70),row('2025-11-05',75)])]},
 '2026-special':{electionDate:'2026-04-21',localities:[]},
 '2026':{electionDate:'2026-11-03',localities:[locality('a',200,[row('2026-09-25',60)])]}
};
test('prefers a four-year peer with usable data, then the prior election',()=>{
 const e=structuredClone(elections);
 e['2022']={electionDate:'2022-11-08',localities:[locality('a',100,[row('2022-09-30',10),row('2022-11-08',40)])]};
 assert.deepEqual(references(e,'2026'),['2022','2025']);
 assert.equal(defaultReference(e,'2022'),'2026'); // Align to the shared cutoff in an election still in progress.
 assert.equal(defaultReference(elections,'2026'),'2025');
 assert.equal(defaultReference(elections,'2024'),null); // No localities to compare.
 assert.equal(defaultReference(e,'2026',[locality('unknown',100,[row('2026-09-25',10)])]),null);
});
test('completed earlier election can compare forward four years',()=>{
 const e={
 '2020':{electionDate:'2020-11-03',localities:[locality('city',100,[row('2020-09-25',1),row('2020-11-03',20)])]},
 '2024':{electionDate:'2024-11-05',localities:[locality('city',120,[row('2024-09-27',2),row('2024-11-05',30)])]}
 };
 assert.equal(defaultReference(e,'2020'),'2024');assert.equal(defaultReference(e,'2024'),'2020');
 assert.equal(compare(e,'2020','2024',e['2020'].localities).past.total,30);
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

test('statewide chart keeps a fixed matched cohort and never extrapolates',()=>{
 const e=structuredClone(elections);e['2026'].localities.push(locality('missing',10000,[row('2026-09-25',9000)]));
 const r=aggregateHistories(e,['2026','2025'],['a','missing']);
 assert.equal(r.count,1);assert.equal(r.eligible,2);
 assert.equal(r.series[0].l.registered,200);assert.equal(r.series[1].l.registered,100);
 assert.equal(r.series[0].l.history.at(-1).total,60);assert.equal(r.series[0].l.history.at(-1).date,'2026-09-25');
 assert.equal(aggregateHistories(e,['2026','2024'],['a']).count,0);
});
test('labels the second Monday in October and the actual election date',()=>{
 assert.deepEqual(dayLabels('2020-10-12','2020-11-03'),['Columbus Day / Indigenous Peoples’ Day']);
 assert.deepEqual(dayLabels('2024-10-14','2024-11-05'),['Columbus Day / Indigenous Peoples’ Day']);
 assert.deepEqual(dayLabels('2024-10-07','2024-11-05'),[]);
 assert.deepEqual(dayLabels('2026-04-21','2026-04-21'),['Election Day']);
});
