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
    
    // Sky Blue replacements
    text = text.replace(/#10b981/ig, '#0ea5e9'); // sky-500
    text = text.replace(/#059669/ig, '#0284c7'); // sky-600
    text = text.replace(/#34d399/ig, '#38bdf8'); // sky-400
    
    // Slate/Grey-Blue dark mode replacements
    text = text.replace(/#111b21/ig, '#0f172a'); // slate-900
    text = text.replace(/#0b141a/ig, '#020617'); // slate-950
    text = text.replace(/#202c33/ig, '#1e293b'); // slate-800
    text = text.replace(/#182229/ig, '#1e293b'); // slate-800 (flattening similar colors)
    text = text.replace(/#2a3942/ig, '#334155'); // slate-700
    text = text.replace(/#374248/ig, '#475569'); // slate-600
    
    // Grey-Blue light mode backgrounds
    text = text.replace(/#f0f2f5/ig, '#f8fafc'); // slate-50

    if (text !== originalText) {
      fs.writeFileSync(filePath, text);
      console.log('Injected Grey-Blue HEX colors in:', filePath);
    }
  }
});
