/* Schedule provenance and presentation helpers. Never infer closure from missing ballots. */
(function(root){
'use strict';
const duration=b=>b?(Number(b[1].slice(0,2))*60+Number(b[1].slice(3))-Number(b[0].slice(0,2))*60-Number(b[0].slice(3)))/60:null;
function prepare(data){
 for(const [id,years] of Object.entries(data.calendars||{}))for(const [year,c] of Object.entries(years)){
  if(c.normalized)continue;
  if(/Historical schedule rules/.test(c.note||'')){
   const report=id==='fairfax-county'?data.official?.[year]:data.siteReports?.[id]?.[year];
   c.hours=Object.fromEntries(Object.entries(c.hours).map(([site,dates])=>[site,Object.fromEntries(Object.entries(dates).filter(([date])=>report?.history.some(r=>r.date===date&&(r.sites?.[site]||0)>0)))]));
   c.partial=true;c.note='Historical activity dates only. Opening-hour templates were reconstructed from archived rules; they are not a verified full schedule. Dates without recorded activity are unverified, not confirmed closed.';
  }else if(/exceptions not specified|does not specify holiday exceptions/.test(c.note||'')){c.partial=true;}
  c.normalized=true;
 }
 return data;
}
function groups(c){
 const result=new Map();
 for(const site of c.sites){const dates=Object.keys(c.hours[site.key]||{}).sort(),signature=JSON.stringify(dates.map(d=>[d,c.hours[site.key][d]]));if(!dates.length)continue;if(!result.has(signature))result.set(signature,{dates,sites:[]});result.get(signature).sites.push(site);}
 return [...result.values()].sort((a,b)=>a.dates[0].localeCompare(b.dates[0]));
}
function dateRuns(dates){
 const result=[];for(const d of dates){const prev=result.at(-1);if(prev&&Date.parse(d)-Date.parse(prev.at(-1))===864e5)prev.push(d);else result.push([d]);}return result;
}
const api={prepare,groups,dateRuns,duration};root.VoteSchedules=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
