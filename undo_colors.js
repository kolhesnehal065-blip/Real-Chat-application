const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'client/src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir(srcDir, function(filePath) {
  if (filePath.endsWith('.jsx') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
    let text = fs.readFileSync(filePath, 'utf8');
    let originalText = text;
    
    // Undo Greens
    text = text.replace(/#88945C/ig, '#10b981'); 
    text = text.replace(/#6B7744/ig, '#059669'); 
    text = text.replace(/#A8B185/ig, '#34d399'); 
    
    // Undo Browns (Dark Mode WhatsApp Replacements)
    text = text.replace(/#1C1916/ig, '#111b21'); 
    text = text.replace(/#11100E/ig, '#0b141a'); 
    text = text.replace(/#2C2823/ig, '#202c33'); 
    text = text.replace(/#24201C/ig, '#182229'); 
    text = text.replace(/#3C362F/ig, '#2a3942'); 
    text = text.replace(/#4B453C/ig, '#374248'); 
    
    // Undo Browns (Light Mode Replacements)
    text = text.replace(/#F6F4F0/ig, '#f0f2f5'); 

    if (text !== originalText) {
      fs.writeFileSync(filePath, text);
      console.log('Reverted HEX colors in:', filePath);
    }
  }
});
