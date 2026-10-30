import {createProfile} from '../demo/profile.mjs';
import {CONTENT} from '../demo/content.mjs';
import {simulateConfiguration} from '../demo/creator-simulation.mjs';
const profile=createProfile(1,0),records=[];
for(const build of ['sword','poison','guard'])for(const chapter of CONTENT.chapters)for(const mode of CONTENT.modes){
 const report=simulateConfiguration(profile,{build,chapter:chapter.id,mode:mode.id,count:1});records.push({build,chapter:chapter.id,mode:mode.id,...report});
}
console.log(JSON.stringify({kind:'actual-rules-default-loadout',count:records.length,records},null,2));
