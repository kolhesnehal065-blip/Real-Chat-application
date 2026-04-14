const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file.includes('node_modules') || file.includes('.git') || file.includes('dist')) continue;

        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const isTSX = file.endsWith('.tsx');
            
            let code = fs.readFileSync(fullPath, 'utf8');

            // Pre-process imports to change extension references BEFORE babel parses
            code = code.replace(/\.tsx'/g, ".jsx'");
            code = code.replace(/\.tsx"/g, '.jsx"');
            code = code.replace(/\.ts'/g, ".js'");
            code = code.replace(/\.ts"/g, '.js"');

            try {
                const result = babel.transformSync(code, {
                    filename: fullPath,
                    plugins: [
                        ["@babel/plugin-transform-typescript", { isTSX: isTSX }],
                        "@babel/plugin-syntax-jsx"
                    ],
                    retainLines: true,
                });
                
                let newExt = isTSX ? '.jsx' : '.js';
                let targetPath = fullPath.replace(/\.tsx?$/, newExt);
                
                fs.writeFileSync(targetPath, result.code, 'utf8');
                fs.unlinkSync(fullPath);
                console.log(`Converted: ${targetPath}`);
            } catch (err) {
                console.error(`Failed to process ${fullPath}:`, err);
            }
        } else if (file === 'index.html') {
             let html = fs.readFileSync(fullPath, 'utf8');
             html = html.replace(/main\.tsx/g, 'main.jsx');
             fs.writeFileSync(fullPath, html, 'utf8');
        }
    }
}

const root = __dirname;
processDirectory(path.join(root, 'client', 'src'));
processDirectory(path.join(root, 'client')); // catches index.html and vite.config.ts
processDirectory(path.join(root, 'server'));

// Cleanup configurations
['client/tsconfig.json', 'client/tsconfig.node.json', 'server/tsconfig.json', 'client/src/vite-env.d.ts'].forEach(f => {
    let p = path.join(root, f);
    if(fs.existsSync(p)) {
        fs.unlinkSync(p);
        console.log('Deleted:', f);
    }
});
console.log('Done processing AST Types!');
