import {createAdventureController} from './controller.mjs';
import {createAdventureUI} from './ui.mjs';
import {createAdventureScene} from './scene.mjs';
import {createAudio} from '../audio.mjs';
import {bindAdventureLifecycle} from './lifecycle.mjs';

export function mountAdventure(root){
 let controller;const audio=createAudio();
 const ui=createAdventureUI(root,action=>{void audio.unlock();return controller?.act(action);});
 const scene=createAdventureScene(ui.canvas);
 let storage;try{storage=globalThis.localStorage;}catch{}
 controller=createAdventureController({storage,scene,audio,render:ui.render,onWorkshop:()=>{globalThis.location.href=new URL('../workshop.html',import.meta.url).href;}});
 let detach=()=>{};
 const destroy=()=>{detach();controller.destroy();ui.destroy();};
 detach=bindAdventureLifecycle(globalThis,{destroy,stop:()=>audio.stop()});
 return {controller,destroy};
}

if(typeof document!=='undefined')mountAdventure(document.getElementById('app'));
