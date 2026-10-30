/** BFCache freezes a live page; it must retain the mounted game for browser Back. */
export function bindAdventureLifecycle(page,{destroy,stop}){
 let attached=true;
 const detach=()=>{if(!attached)return;attached=false;page.removeEventListener('pagehide',leave);};
 function leave(event){
  if(event.persisted){stop?.();return;}
  detach();destroy();
 }
 page.addEventListener('pagehide',leave);
 return detach;
}
