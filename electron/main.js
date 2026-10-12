const {app,BrowserWindow,globalShortcut}=require('electron');
const path=require('path');
app.whenReady().then(()=>{
  const win=new BrowserWindow({
    width:1500,height:900,fullscreenable:true,
    backgroundColor:'#07080d',autoHideMenuBar:true,
    title:'RACE AUTHORITY',
    webPreferences:{contextIsolation:true}});
  win.loadFile(path.join(__dirname,'..','index.html'));
  // F11 / Alt+Enter toggle fullscreen — windowed by default, like real games
  globalShortcut.register('F11',()=>win.setFullScreen(!win.isFullScreen()));
  globalShortcut.register('Alt+Enter',()=>win.setFullScreen(!win.isFullScreen()));
});
app.on('window-all-closed',()=>app.quit());
