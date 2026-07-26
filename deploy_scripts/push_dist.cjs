const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const path = require('path');
const { getVpsSshConfig, getVpsConnection } = require('./_vpsConnect.cjs');

async function uploadDist() {
  try {
    console.log('🔗 Connecting...');
    await ssh.connect(getVpsSshConfig());
    
    console.log('📁 Uploading latest dist build...');
    const localDir = path.join(__dirname, 'QUANLYCMS/client/dist');
    const remoteDir = '/www/wwwroot/quanlycms/client/dist';
    
    await ssh.execCommand(`rm -rf ${remoteDir} && mkdir -p ${remoteDir}`);
    
    const failed = [];
    const successful = [];
    
    await ssh.putDirectory(localDir, remoteDir, {
      recursive: true,
      concurrency: 10,
      tick: function(localPath, remotePath, error) {
        if (error) { failed.push(localPath); }
        else { successful.push(localPath); }
      }
    });
    
    console.log(`✅ Uploaded ${successful.length} files.`);
    if (failed.length > 0) console.log(`❌ Failed: ${failed.length}`, failed);
    
    console.log('♻️ Reloading Apache...');
    await ssh.execCommand('/www/server/apache/bin/apachectl graceful');
    
    console.log('🎉 Done! Web VPS đã cập nhật code mới nhất.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
uploadDist();
