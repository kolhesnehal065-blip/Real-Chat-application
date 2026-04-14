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
    // Greens
    text = text.replace(/#10b981/ig, '#88945C'); // emerald-500 -> sage
    text = text.replace(/#059669/ig, '#6B7744'); // emerald-600 -> olive
    text = text.replace(/#34d399/ig, '#A8B185'); // emerald-400 -> light sage
    
    // Browns (Dark Mode WhatsApp Replacements)
    text = text.replace(/#111b21/ig, '#1C1916'); // deepest mocha
    text = text.replace(/#0b141a/ig, '#11100E'); // basically black mocha
    text = text.replace(/#202c33/ig, '#2C2823'); // lighter mocha
    text = text.replace(/#182229/ig, '#24201C'); 
    text = text.replace(/#2a3942/ig, '#3C362F'); 
    text = text.replace(/#374248/ig, '#4B453C'); 
    
    // Browns (Light Mode Replacements)
    text = text.replace(/#f0f2f5/ig, '#F6F4F0'); // sand

    if (text !== originalText) {
      fs.writeFileSync(filePath, text);
      console.log('Updated HEX colors in:', filePath);
    }
  }
});
