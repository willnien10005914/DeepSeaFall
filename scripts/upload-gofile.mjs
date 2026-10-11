/** Upload a file to GoFile (guest) and print the download page URL. */
import { readFileSync, statSync } from "fs";
import { basename } from "path";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node upload-gofile.mjs <file>");
  process.exit(1);
}

const serversRes = await fetch("https://api.gofile.io/servers");
const serversJson = await serversRes.json();
if (serversJson.status !== "ok") throw new Error("Failed to get GoFile servers");
const server = serversJson.data.servers[0].name;
console.log("Using server", server);

const buf = readFileSync(filePath);
const blob = new Blob([buf]);
const form = new FormData();
form.append("file", blob, basename(filePath));

const uploadUrl = `https://${server}.gofile.io/contents/uploadfile`;
console.log("Uploading", basename(filePath), `(${(statSync(filePath).size / 1024 / 1024).toFixed(1)} MB)...`);
const res = await fetch(uploadUrl, { method: "POST", body: form });
const json = await res.json();
if (json.status !== "ok") {
  console.error(JSON.stringify(json, null, 2));
  throw new Error("GoFile upload failed");
}
const { downloadPage, fileId, fileName } = json.data;
console.log(JSON.stringify({ downloadPage, fileId, fileName, server }, null, 2));
console.log("\nGOFILE_URL=" + downloadPage);
