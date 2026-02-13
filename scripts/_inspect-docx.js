#!/usr/bin/env node
const AdmZip = require("adm-zip");
const docxPath = process.argv[2] || "dist/whitepaper-docx/investor-brief.docx";
const zip = new AdmZip(docxPath);

// List all entries
console.log("=== ALL ENTRIES ===");
zip.getEntries().forEach(e => console.log("  " + e.entryName + " (" + e.header.size + " bytes)"));

// Relationships
const relsEntry = zip.getEntry("word/_rels/document.xml.rels");
if (relsEntry) {
  const rels = relsEntry.getData().toString("utf8");
  console.log("\n=== IMAGE RELATIONSHIPS ===");
  const re = /Relationship[^>]*Target="media[^"]*"[^>]*/g;
  let m;
  while ((m = re.exec(rels)) !== null) console.log("  " + m[0]);

  // Also show all relationships
  console.log("\n=== ALL RELATIONSHIPS ===");
  const allRe = /Relationship[^/]*/g;
  while ((m = allRe.exec(rels)) !== null) console.log("  " + m[0]);
}

// Document.xml: look for drawing/image references
const docEntry = zip.getEntry("word/document.xml");
if (docEntry) {
  const doc = docEntry.getData().toString("utf8");

  // Count drawing elements
  const drawingCount = (doc.match(/<w:drawing>/g) || []).length;
  console.log("\n=== DOCUMENT.XML ===");
  console.log("  <w:drawing> count:", drawingCount);

  // Find blip references (embedded images)
  const blipRe = /a:blip[^>]*r:embed="([^"]*)"/g;
  let blipMatch;
  console.log("  Blip r:embed refs:");
  while ((blipMatch = blipRe.exec(doc)) !== null) {
    console.log("    " + blipMatch[1]);
  }

  // Find image size/extent info
  const extentRe = /<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"/g;
  let extMatch;
  console.log("  Image extents (cx x cy EMU):");
  while ((extMatch = extentRe.exec(doc)) !== null) {
    const cx = parseInt(extMatch[1]);
    const cy = parseInt(extMatch[2]);
    console.log(`    ${cx} x ${cy} (${(cx/914400).toFixed(2)}" x ${(cy/914400).toFixed(2)}")`);
  }

  // Check for any w:pict (VML images)
  const pictCount = (doc.match(/<w:pict>/g) || []).length;
  console.log("  <w:pict> count:", pictCount);
}
