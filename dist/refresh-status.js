'use strict';
// Separate operational status from ballot counts and their coverage dates.
async function refreshHeaderStatus(){
  const notice=document.getElementById('refresh-delay');
  if(!notice)return;
  try{
    const response=await fetch('refresh-status.json',{cache:'no-store'});
    if(!response.ok)return;
    const status=await response.json();
    if(typeof status.delayed==='boolean')notice.hidden=!status.delayed;
  }catch{
    // A visitor's connection failure is not evidence that the data import failed.
    // Preserve any notice already shown.
  }
}
refreshHeaderStatus();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshHeaderStatus()});
setInterval(()=>{if(!document.hidden)refreshHeaderStatus()},300000);
