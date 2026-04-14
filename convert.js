const fs = require('fs');
const path = require('path');

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file.includes('node_modules') || file.includes('.git') || file.includes('dist')) continue;

        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');

            // 1. Remove typescript extensions in imports natively (.ts -> .js, .tsx -> .jsx)
            content = content.replace(/\.tsx'/g, ".jsx'");
            content = content.replace(/\.tsx"/g, '.jsx"');
            content = content.replace(/\.ts'/g, ".js'");
            content = content.replace(/\.ts"/g, '.js"');

            // 2. Strip basic TS annotations
            content = content.replace(/: any\[\]/g, '');
            content = content.replace(/<any\[\]>/g, '');
            content = content.replace(/: any/g, '');
            content = content.replace(/<any>/g, '');
            content = content.replace(/: React\.FormEvent<HTMLFormElement>/g, '');
            content = content.replace(/: React\.FormEvent/g, '');
            content = content.replace(/: React\.ChangeEvent<HTMLInputElement>/g, '');
            content = content.replace(/: React\.ReactNode/g, '');
            content = content.replace(/\{\s*children\s*\}\s*:\s*\{\s*children\s*/g, '{ children }: { children'); // just in case
            // Let's do a smarter replace for the ProtectedRoute typed param specifically
            content = content.replace(/\{ children \}: \{ children: React\.ReactNode \}/g, '{ children }');

            // 3. Strip variables types in loops and destructs
            content = content.replace(/\[string, any\]/g, '');
            content = content.replace(/:\s*\[string,\s*any\]/g, '');
            
            // 4. Strip Express Request/Response
            content = content.replace(/: Request/g, '');
            content = content.replace(/: Response/g, '');
            content = content.replace(/import { Request, Response } from 'express';/g, '');
            content = content.replace(/import { Request, Response, NextFunction } from 'express';/g, '');
            content = content.replace(/: NextFunction/g, '');
            content = content.replace(/<string>/g, '');
            content = content.replace(/: string/g, '');
            content = content.replace(/: boolean/g, '');

            let newExt = file.endsWith('.tsx') ? '.jsx' : '.js';
            let targetPath = fullPath.replace(/\.tsx?$/, newExt);
            
            fs.writeFileSync(targetPath, content, 'utf8');
            fs.unlinkSync(fullPath);
            console.log(`Converted: ${fullPath} -> ${targetPath}`);
        } else if (file === 'index.html' && dir.includes('client')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            content = content.replace(/main\.tsx/g, 'main.jsx');
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Updated index.html: ${fullPath}`);
        } else if (file === 'vite.config.ts') {
            // Already handled by the extension rule above, just need to make sure we don't skip it
        }
    }
}

const root = path.join(__dirname);
// We want to process client/src, server, and client/vite.config.ts
if (fs.existsSync(path.join(root, 'client', 'src'))) processDirectory(path.join(root, 'client', 'src'));
if (fs.existsSync(path.join(root, 'server'))) processDirectory(path.join(root, 'server'));

const viteConfTs = path.join(root, 'client', 'vite.config.ts');
if (fs.existsSync(viteConfTs)) {
   let text = fs.readFileSync(viteConfTs, 'utf8');
   fs.writeFileSync(path.join(root, 'client', 'vite.config.js'), text.replace(/defineConfig/g, 'defineConfig'), 'utf8');
   fs.unlinkSync(viteConfTs);
   console.log('Converted: vite.config.ts -> vite.config.js');
}

// Cleanup configs
['client/tsconfig.json', 'client/tsconfig.node.json', 'server/tsconfig.json', 'client/src/vite-env.d.ts'].forEach(f => {
    let p = path.join(root, f);
    if(fs.existsSync(p)) {
        fs.unlinkSync(p);
        console.log('Deleted:', f);
    }
});

console.log('Done!');
