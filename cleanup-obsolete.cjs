// Safe source-update migration. App settings and user files are never scanned.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const obsolete={"app-icon.png":"6c94628c7cb690244c883516b3cb6ef70be75d16d8346f3c9e2707a57c319ee9","app-icon.ico":"abf8cd5d035a01d9888a7b3543a7fed2fb95fcffd64e450f963edea6ab58c517","tray.png":"7e5df461e2a06a5fcd14a3a9f612f541566663e541ea949bbd6537df39e32af8","assets/default-rug.png":"ed9417d92cae7c725221d677d0b7636754dcce63aac56a0943675b9abc6d0eac","assets/water.png":"d5d6e90894806ffc1671ec2f5c9f84ce19b776e3f7bb06f286db4ed65582ac38","assets/ember.png":"6e71a4e1dc29e1824578b61653822a55eb9db5fd2d3bde6996ce096805fadd86","assets/serpent.webp":"e46e88ab3381f17aa9fa799e6e4b00eaa73d52eebaace789ee28dea443d7ad55","assets/sound.webp":"889b01d1d2468fd5a7d30600431c88e38ceb60b98e65ea329be2838082cb2e15","assets/insect.webp":"e17422db3db3ad159041af318c5fd69e41325b20abf4084a3d9da457d0ffd9f2","DAMAGE-PLAN.md":"e04a5a9f11c86723d65346e1b89896502341abb1be618363c041a9e930ef2d27"};
for(const [relative,expected]of Object.entries(obsolete)){
 const file=path.join(__dirname,relative);
 try{if(!fs.existsSync(file)||!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())continue;
  if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')===expected)fs.unlinkSync(file);
 }catch(error){console.warn('Old asset could not be removed:',relative,error.code);}
}
