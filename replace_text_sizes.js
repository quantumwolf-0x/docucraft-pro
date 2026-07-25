const fs = require("fs");
const path = require("path");

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach((f) => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir("./src", function (filePath) {
  if (filePath.endsWith(".tsx") || filePath.endsWith(".ts")) {
    let content = fs.readFileSync(filePath, "utf-8");
    let original = content;

    // text-[10px], text-[11px], text-[12px] -> text-xs
    content = content.replace(/text-\[10px\]/g, "text-xs");
    content = content.replace(/text-\[11px\]/g, "text-xs");
    content = content.replace(/text-\[12px\]/g, "text-xs");
    // text-[13px], text-[14px] -> text-sm
    content = content.replace(/text-\[13px\]/g, "text-sm");
    content = content.replace(/text-\[14px\]/g, "text-sm");
    // text-[15px], text-[16px] -> text-base
    content = content.replace(/text-\[15px\]/g, "text-base");
    content = content.replace(/text-\[16px\]/g, "text-base");

    if (content !== original) {
      fs.writeFileSync(filePath, content, "utf-8");
      console.log("Updated", filePath);
    }
  }
});
