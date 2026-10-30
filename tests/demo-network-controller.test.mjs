import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile} from '../demo/profile.mjs';
import {createNetworkController} from '../demo/network-controller.mjs';
function fixture(extra={}){let profile=createProfile(),writes=0,uploads=0;const remote=createProfile(7);remote.resources.gold=321;const client={health:async()=>({ok:true}),session:async()=>({ok:true,user:{id:'u',username:'侠客'}}),loadProfile:async()=>({ok:true,profile:remote,revision:2}),saveProfile:async()=>{uploads++;return {ok:true,revision:3};},leaderboard:async()=>({ok:true,entries:[]}),listGuilds:async()=>({ok:true,guilds:[]}),arena:async()=>({ok:true,queued:false,match:null}),...extra};const c=createNetworkController({client,getProfile:()=>profile,setProfile:p=>{profile=p;writes++;},onChange:()=>{}});return {c,get profile(){return profile;},get writes(){return writes;},get uploads(){return uploads;},remote};}
test('connection reads metadata but never uploads or replaces local data automatically',async()=>{
 const f=fixture(),before=JSON.stringify(f.profile);await f.c.act({type:'refresh'});assert.equal(f.c.state.user.id,'u');assert.equal(f.c.state.profileRevision,2);assert.equal(f.uploads,0);assert.equal(f.writes,0);assert.equal(JSON.stringify(f.profile),before);f.c.destroy();
});
test('explicit cloud load validates before replacing local profile and explicit save uses revision',async()=>{
 let args;const f=fixture({saveProfile:async(...a)=>{args=a;return {ok:true,revision:3};}});await f.c.act({type:'refresh'});await f.c.act({type:'load-profile'});assert.equal(f.profile.resources.gold,321);assert.equal(f.writes,1);await f.c.act({type:'save-profile'});assert.equal(args[1],2);assert.equal(f.c.state.profileRevision,3);f.c.destroy();
});
test('failed sync and invalid remote content preserve local state',async()=>{
 const f=fixture({loadProfile:async()=>({ok:true,profile:{bad:true},revision:4})});const before=f.profile;await f.c.act({type:'refresh'});await f.c.act({type:'load-profile'});assert.equal(f.profile,before);assert.equal(f.writes,0);assert.ok(f.c.state.error);f.c.destroy();
});
test('destroyed pending download cannot replace profile or render late response',async()=>{
 let resolve,events=0;const p=new Promise(r=>resolve=r),f=fixture();const c=createNetworkController({client:{...{session:async()=>({ok:true,user:{id:'u'}})},loadProfile:()=>p},getProfile:()=>f.profile,setProfile:()=>{events++;},onChange:()=>{events++;}});const task=c.act({type:'load-profile'});c.destroy();const before=events;resolve({ok:true,profile:f.remote,revision:1});await task;assert.equal(events,before);f.c.destroy();
});

test('refresh recovers membership after a new login without attempting to join again',async()=>{
 const guild={id:'g-one',name:'清风会',members:[{id:'u',username:'侠客'}],messages:[]};const f=fixture({listGuilds:async()=>({guilds:[{id:guild.id,mine:true}]}),guild:async id=>{assert.equal(id,guild.id);return {guild};}});await f.c.act({type:'refresh'});assert.deepEqual(f.c.state.guild,guild);f.c.destroy();
});
