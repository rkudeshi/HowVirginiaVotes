/* Compare aggregate early votes at matched election-relative reporting cutoffs. */
(function(root) {
  'use strict';
  const offset = (date, electionDate) => Math.round((Date.parse(date)-Date.parse(electionDate))/864e5);
  function choices(elections, key, localities=elections[key].localities) {
    return Object.keys(elections).filter(k => k!==key && compare(elections,key,k,localities).count>0)
      .sort((a,b) => elections[b].electionDate.localeCompare(elections[a].electionDate));
  }
  function references(elections,key,localities=elections[key].localities) {
    const available=choices(elections,key,localities), date=elections[key].electionDate, y=Number(date.slice(0,4)), month=date.slice(5,7);
    const matching=(yr,m=month)=>available.find(k=>elections[k].electionDate.startsWith(`${yr}-${m}`));
    const prior=available.filter(k=>elections[k].electionDate<date);
    const next=available.filter(k=>elections[k].electionDate>date).reverse();
    const preceding=matching(y-1,'11')||prior.find(k=>elections[k].electionDate.slice(5,7)===month)||prior[0];
    const primary=matching(y+4)||matching(y-4)||preceding||next[0];
    return [...new Set([primary,preceding].filter(Boolean))];
  }
  function defaultReference(elections,key,localities=elections[key].localities) {
    return references(elections,key,localities)[0]||null;
  }
  const empty = () => ({total:0,early:0,mail:0,registered:0});
  function compare(elections, key, reference, localities) {
    const current=empty(), past=empty(), pairs=[], e=elections[key], p=elections[reference];
    const pastLocalities=new Map((p?.localities||[]).map(l=>[l.id,l]));
    for (const l of localities) {
      const previous=pastLocalities.get(l.id);
      if (!l.history.length || !previous?.history.length || !(l.registered>0) || !(previous.registered>0)) continue;
      // Use the latest cutoff covered by both elections, including a newer election still in progress.
      const dx=Math.min(0,offset(l.history.at(-1).date,e.electionDate),offset(previous.history.at(-1).date,p.electionDate));
      const a=l.history.filter(r=>offset(r.date,e.electionDate)<=dx).at(-1);
      const b=previous.history.filter(r=>offset(r.date,p.electionDate)<=dx).at(-1);
      if (!a || !b) continue;
      for (const k of ['total','early','mail']) { current[k]+=a[k]; past[k]+=b[k]; }
      current.registered+=l.registered; past.registered+=previous.registered;
      pairs.push({id:l.id,dx,current:a,past:b,currentRegistered:l.registered,pastRegistered:previous.registered});
    }
    return {current,past,pairs,count:pairs.length,eligible:localities.length,
      delta:pairs.length?100*(current.total/current.registered-past.total/past.registered):null};
  }
  function aggregateHistories(elections,keys,ids) {
    const maps=Object.fromEntries(keys.map(k=>[k,new Map(elections[k].localities.map(l=>[l.id,l]))]));
    const cohort=ids.filter(id=>keys.every(k=>maps[k].get(id)?.history.length&&maps[k].get(id).registered>0));
    const series=keys.map(k=>{
      const e=elections[k],members=cohort.map(id=>maps[k].get(id)),history=[];
      if(members.length)for(let dx=-65;dx<=10;dx++) {
        const rows=members.map(l=>offset(l.history.at(-1).date,e.electionDate)<dx?null:l.history.filter(r=>offset(r.date,e.electionDate)<=dx).at(-1));
        if(rows.some(r=>!r))continue;
        const date=new Date(Date.parse(e.electionDate)+dx*864e5).toISOString().slice(0,10);
        history.push({date,...Object.fromEntries(['total','early','mail'].map(m=>[m,rows.reduce((sum,r)=>sum+r[m],0)]))});
      }
      return {k,e,l:{history,registered:members.reduce((sum,l)=>sum+l.registered,0)}};
    });
    return {series,count:cohort.length,eligible:ids.length};
  }
  function dayLabels(day,electionDate) {
    const d=new Date(day+'T12:00:00Z'),labels=[];
    if(d.getUTCMonth()===9&&d.getUTCDay()===1&&d.getUTCDate()>=8&&d.getUTCDate()<=14)labels.push('Columbus Day / Indigenous Peoples’ Day');
    if(day===electionDate)labels.push('Election Day');
    return labels;
  }
  const api={choices,references,defaultReference,compare,aggregateHistories,dayLabels};
  if(typeof module!=='undefined')module.exports=api;
  root.VoteComparison=api;
})(typeof window!=='undefined'?window:globalThis);
