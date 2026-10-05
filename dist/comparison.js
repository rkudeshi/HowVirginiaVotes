/* Compare aggregate early votes at matched election-relative reporting cutoffs. */
(function(root) {
  'use strict';
  const offset = (date, electionDate) => Math.round((Date.parse(date)-Date.parse(electionDate))/864e5);
  function choices(elections, key) {
    return Object.keys(elections).filter(k => elections[k].electionDate < elections[key].electionDate)
      .sort((a,b) => elections[b].electionDate.localeCompare(elections[a].electionDate));
  }
  function defaultReference(elections, key) {
    const prior = choices(elections, key), previousYear = String(Number(elections[key].electionDate.slice(0,4))-1);
    return prior.find(k => elections[k].electionDate.startsWith(previousYear+'-11')) || prior[0] || null;
  }
  const empty = () => ({total:0,early:0,mail:0,registered:0});
  function compare(elections, key, reference, localities) {
    const current=empty(), past=empty(), pairs=[], e=elections[key], p=elections[reference];
    const pastLocalities=new Map((p?.localities||[]).map(l=>[l.id,l]));
    for (const l of localities) {
      const previous=pastLocalities.get(l.id);
      if (!l.history.length || !previous?.history.length || !(l.registered>0) || !(previous.registered>0)) continue;
      const dx=Math.min(0,offset(l.history.at(-1).date,e.electionDate));
      // Never extrapolate beyond a locality's last available report, or invent zeros.
      if (offset(previous.history.at(-1).date,p.electionDate)<dx) continue;
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
  const api={choices,defaultReference,compare};
  if(typeof module!=='undefined')module.exports=api;
  root.VoteComparison=api;
})(typeof window!=='undefined'?window:globalThis);
