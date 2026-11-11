import {createAdventureController} from './controller.mjs';
import {createAdventureUI} from './ui.mjs';
import {createAdventureScene} from './scene.mjs';
import {createAudio} from '../audio.mjs';
import {createCampaignUI} from './campaign-ui.mjs';
import {bindAdventureLifecycle} from './lifecycle.mjs';

export function mountAdventure(root){
 let controller;const audio=createAudio();
 const ui=createAdventureUI(root,action=>{void audio.unlock();return controller?.act(action);});
 const campaignUI=createCampaignUI(root,action=>controller?.act(action));
 const scene=createAdventureScene(ui.canvas);
 let storage;try{storage=globalThis.localStorage;}catch{}
 controller=createAdventureController({storage,scene,audio,render:(state,options)=>{ui.render(state,options);campaignUI.render(options.campaign,{open:options.campaignOpen,tab:options.campaignTab,busy:options.busy,chapterId:state.chapterId,message:options.message});},onWorkshop:()=>{globalThis.location.href=new URL('../workshop.html',import.meta.url).href;}});
 let detach=()=>{};
 const destroy=()=>{detach();controller.destroy();campaignUI.destroy();ui.destroy();};
 detach=bindAdventureLifecycle(globalThis,{destroy,stop:()=>audio.stop()});
 return {controller,destroy};
}

if(typeof document!=='undefined')mountAdventure(document.getElementById('app'));
