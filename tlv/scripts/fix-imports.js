const fs = require("fs");
const path = require("path");

function fixImports(dir, from, to) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) return;
    if (!file.endsWith(".ts")) return;
    let content = fs.readFileSync(fullPath, "utf8");
    const newContent = content.replace(new RegExp(from, "g"), to);
    if (content !== newContent) {
      fs.writeFileSync(fullPath, newContent, "utf8");
      console.log(`Fixed imports in: ${fullPath}`);
    }
  });
}

fixImports(path.join(__dirname, "../tests/parser"), "../src", "../../src/parser");
fixImports(path.join(__dirname, "../tests/builder"), "../src", "../../src/builder");