import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REPOSITORY = "https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman";
const OUTPUT_DIRECTORY = path.resolve("client/public/models");
const ADULT_MODEL_OUTPUT = path.join(OUTPUT_DIRECTORY, "lund-browder-athletic-male.obj");
const PEDIATRIC_CHILD_OUTPUT = path.join(OUTPUT_DIRECTORY, "lund-browder-pediatric-child.obj");
const PEDIATRIC_INFANT_OUTPUT = path.join(OUTPUT_DIRECTORY, "lund-browder-pediatric-infant.obj");
const TEXTURE_OUTPUT = path.join(OUTPUT_DIRECTORY, "lund-browder-male-skin.png");
const MANIFEST_OUTPUT = path.join(OUTPUT_DIRECTORY, "lund-browder-model-manifest.json");
const LOCKED_ADULT_SHA256 = "0964cc763a5f91a0bf427edf5af52c20ad5b86b15a826fa1d9f9e7e1ea9d4117";
const LOCKED_TEXTURE_SHA256 = "862a26e335e958b70534cb5f0d7c47ef30ab148a56c42b3e9da969cf76f12963";

const adultTargets = [
  ["data/targets/macrodetails/caucasian-male-young.target", 1],
  ["data/targets/macrodetails/universal-male-young-maxmuscle-averageweight.target", 0.9],
  ["data/targets/macrodetails/proportions/male-young-maxmuscle-averageweight-idealproportions.target", 0.18],
  ["data/targets/torso/torso-muscle-pectoral-incr.target", 0.46],
  ["data/targets/torso/torso-muscle-dorsi-incr.target", 0.36],
  ["data/targets/torso/torso-vshape-incr.target", 0.2],
  ["data/targets/armslegs/l-lowerarm-muscle-incr.target", 0.27],
  ["data/targets/armslegs/r-lowerarm-muscle-incr.target", 0.27],
  ["data/targets/armslegs/l-lowerleg-muscle-incr.target", 0.23],
  ["data/targets/armslegs/r-lowerleg-muscle-incr.target", 0.23],
  ["data/targets/armslegs/l-upperarm-muscle-incr.target", 0.34],
  ["data/targets/armslegs/r-upperarm-muscle-incr.target", 0.34],
  ["data/targets/armslegs/l-upperarm-shoulder-muscle-incr.target", 0.38],
  ["data/targets/armslegs/r-upperarm-shoulder-muscle-incr.target", 0.38],
  ["data/targets/armslegs/l-upperleg-muscle-incr.target", 0.24],
  ["data/targets/armslegs/r-upperleg-muscle-incr.target", 0.24],
];

const pediatricChildTargets = [
  ["data/targets/macrodetails/caucasian-male-child.target", 1],
  ["data/targets/macrodetails/universal-male-child-averagemuscle-averageweight.target", 1],
  ["data/targets/macrodetails/proportions/male-child-averagemuscle-averageweight-idealproportions.target", 0.16],
];

const pediatricInfantTargets = [
  ["data/targets/macrodetails/caucasian-male-baby.target", 1],
  ["data/targets/macrodetails/universal-male-baby-averagemuscle-averageweight.target", 1],
];

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return response;
}

async function text(url) {
  return (await download(url)).text();
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function targetOffsets(source) {
  const offsets = [];
  for (const line of source.split(/\r?\n/)) {
    if (!/^\d/.test(line)) continue;
    const [index, x, y, z] = line.trim().split(/\s+/).map(Number);
    offsets.push([index, x, y, z]);
  }
  return offsets;
}

async function buildTargetedModel(baseVertices, textureCoordinates, bodyFaces, targets, label) {
  const vertices = baseVertices.map((vertex) => [...vertex]);
  for (const [targetPath, strength] of targets) {
    const source = await text(`${REPOSITORY}/${targetPath}`);
    for (const [index, x, y, z] of targetOffsets(source)) {
      vertices[index][0] += x * strength;
      vertices[index][1] += y * strength;
      vertices[index][2] += z * strength;
    }
  }
  return [
    `# Codical Lund-Browder ${label} anatomical model`,
    "# Generated from the MakeHuman hm08 base mesh and CC0 targets.",
    "# See MODEL-LICENSE.md for source and license details.",
    ...vertices.map(([x, y, z]) => `v ${x.toFixed(5)} ${y.toFixed(5)} ${z.toFixed(5)}`),
    ...textureCoordinates,
    "g body",
    ...bodyFaces,
    "",
  ].join("\n");
}

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
const baseSource = await text(`${REPOSITORY}/data/3dobjs/base.obj`);
const baseLines = baseSource.split(/\r?\n/);
const baseVertices = baseLines.filter((line) => line.startsWith("v ")).map((line) => line.trim().split(/\s+/).slice(1, 4).map(Number));
const textureCoordinates = baseLines.filter((line) => line.startsWith("vt "));
let group = "";
const bodyFaces = [];
for (const line of baseLines) {
  if (line.startsWith("g ")) group = line.slice(2).trim();
  else if (group === "body" && line.startsWith("f ")) bodyFaces.push(line);
}

const regenerateAdult = process.argv.includes("--regenerate-adult");
if (regenerateAdult) {
  const adultModel = await buildTargetedModel(baseVertices, textureCoordinates, bodyFaces, adultTargets, "athletic");
  await writeFile(ADULT_MODEL_OUTPUT, adultModel, "utf8");
}

const adultModel = await readFile(ADULT_MODEL_OUTPUT);
const adultHash = sha256(adultModel);
if (adultHash !== LOCKED_ADULT_SHA256) {
  throw new Error(`Locked adult model hash changed: ${adultHash}`);
}
const skinTexture = await readFile(TEXTURE_OUTPUT);
const textureHash = sha256(skinTexture);
if (textureHash !== LOCKED_TEXTURE_SHA256) {
  throw new Error(`Locked skin texture hash changed: ${textureHash}`);
}

const pediatricChild = await buildTargetedModel(baseVertices, textureCoordinates, bodyFaces, pediatricChildTargets, "pediatric child");
const pediatricInfant = await buildTargetedModel(baseVertices, textureCoordinates, bodyFaces, pediatricInfantTargets, "pediatric infant");
await writeFile(PEDIATRIC_CHILD_OUTPUT, pediatricChild, "utf8");
await writeFile(PEDIATRIC_INFANT_OUTPUT, pediatricInfant, "utf8");

const manifest = {
  version: 1,
  adult: { locked: true, path: "lund-browder-athletic-male.obj", sha256: adultHash },
  skin: { locked: true, path: "lund-browder-male-skin.png", sha256: textureHash },
  pediatric: {
    switchAge: 18,
    canonicalTopology: "adult",
    child: { path: "lund-browder-pediatric-child.obj", sha256: sha256(pediatricChild) },
    infant: { path: "lund-browder-pediatric-infant.obj", sha256: sha256(pediatricInfant) },
  },
};
await writeFile(MANIFEST_OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  adult: manifest.adult,
  pediatric: manifest.pediatric,
  vertices: baseVertices.length,
  bodyFaces: bodyFaces.length,
}, null, 2));
