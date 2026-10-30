import path from 'node:path';
import {createGameServer,NODE_REQUIREMENT} from './server.mjs';
const major=Number(process.versions.node.split('.')[0]);if(major<22)throw new Error(NODE_REQUIREMENT);
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||8768);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT must be 0..65535');
const server=createGameServer({dataDir:process.env.QIPAI_DATA_DIR?path.resolve(process.env.QIPAI_DATA_DIR):undefined,publicOrigin:process.env.QIPAI_PUBLIC_ORIGIN||null});
server.on('error',error=>{console.error(`服务启动失败：${error.message}`);process.exitCode=1;});
server.listen(port,host,()=>{console.log(`七派江湖本机服务：http://${host}:${server.address().port}/ (${NODE_REQUIREMENT})`);});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(()=>process.exit(0));});
