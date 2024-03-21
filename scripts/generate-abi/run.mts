import { fileURLToPath } from "url";
import path from "path";
import { runTypeChain } from "typechain";
import fse from "fs-extra";
import { execa } from "execa";
import glob from "glob";
import chalk from "chalk";
import { logger as scriptLogger } from "../logger.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = scriptLogger("generate-abi");

(async () => {
  logger.info("Started");

  const cwd = process.cwd();
  const inputJsonDirectory = path
    .join(__dirname, "abi-json")
    .split(path.sep)
    .join("/");
  const outputJsonDirectory = path
    .join(__dirname, "abi-json/temp")
    .split(path.sep)
    .join("/");
  const typesOutputDirectory = path
    .join(process.cwd(), "src/abi")
    .split(path.sep)
    .join("/");

  logger.info(`Using ABI JSON directory ${inputJsonDirectory}`);
  logger.info(
    `Using TypeChain-generated files directory ${typesOutputDirectory}`
  );

  const filesToDelete = glob.sync(
    path.join(typesOutputDirectory, "**/!(*.md)").split(path.sep).join("/")
  );
  filesToDelete?.forEach((f) =>
    fse.rmSync(f, { recursive: true, force: true })
  );
  logger.info("Deleted existing TypeChain files in types output directory");

  await fse.rm(outputJsonDirectory, { recursive: true, force: true });
  logger.info("Deleted existing files in JSON output temporary directory");

  const abiJsonFiles: string[] = glob.sync(
    path.join(inputJsonDirectory, `*.json`).split(path.sep).join("/")
  );

  logger.info(`Found ${abiJsonFiles.length} ABI JSON files`);

  let abiIdx = 1;

  // Save each JSON file in temp directory after parsing applying transformations
  for (const file of abiJsonFiles) {
    const fileName = path.basename(file);
    const finalOutputFile = path
      .join(outputJsonDirectory, fileName)
      .split(path.sep)
      .join("/");
    await fse.copy(file, finalOutputFile, { overwrite: true });

    const fileData = await fse.readFile(finalOutputFile, "utf8");
    const parsedFileData = JSON.parse(fileData);

    // Remove bytecode in case the ABI JSON came from a compiler
    // This will reduce the size of the JSON loaded by the user in the browser
    parsedFileData.bytecode = undefined;
    parsedFileData.deployedBytecode = undefined;
    await fse.writeFile(
      finalOutputFile,
      JSON.stringify(parsedFileData.abi ?? parsedFileData),
      "utf8"
    );

    logger.info(
      `(ABI ${abiIdx++}/${abiJsonFiles.length}) Processed JSON for ${fileName}`
    );
  }

  const jsonGlobPath = path
    .join(outputJsonDirectory, "**/*.json")
    .split(path.sep)
    .join("/");
  const files = glob.sync(jsonGlobPath);

  if (!files?.length) {
    throw new Error(`No files found for glob pattern ${jsonGlobPath}`);
  } else {
    logger.info(`Found ${files.length} files to run prettier for`);
  }

  // Run prettier formatting on output
  const promiseForPrettier = execa("npx", [
    "prettier",
    "--write",
    `${outputJsonDirectory}/**/*.json`,
  ]);

  promiseForPrettier.stdout?.on("data", (data) => {
    if (data.length) {
      logger.info(`(prettier) Formatted ${chalk(data).trim()}`);
    }
  });

  promiseForPrettier.stderr?.on("data", (data) => {
    if (data.length) {
      logger.error(`(prettier) Formatted ${chalk(data).trim()}`);
    }
  });

  await promiseForPrettier;

  logger.info(`Found ${files.length} JSON ABI files to parse with TypeChain`);

  const result = await runTypeChain({
    cwd,
    filesToProcess: files,
    allFiles: files,
    outDir: typesOutputDirectory,
    target: "ethers-v5",
  });

  logger.info(`Generated ${result.filesGenerated} files from the ABI data`);

  if (result.filesGenerated === 0) {
    throw new Error("Could not generate any files from given ABI config");
  }

  // Transform factories files to remove gas, which causes compile errors
  logger.info(`Transforming output...`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outputFactoryFiles: any[] = glob.sync(
    path.join(typesOutputDirectory, "factories/*.ts").split(path.sep).join("/")
  );

  if (!outputFactoryFiles || outputFactoryFiles.length === 0) {
    throw new Error("Could not find any outputted factory files to transform");
  }

  // Remove invalid items from the ABI JSON
  for (const file of outputFactoryFiles) {
    let fileData = await fse.readFile(file, "utf8");
    const containsBadData = fileData.search(/gas:[\s+\d+]+,/g) >= 0;
    if (containsBadData) {
      logger.warn(
        `File ${path.basename(
          file
        )} contains data that will cause compile errors. We will transform the file. `
      );
      fileData = fileData.replace(/gas:[\s+\d+]+,/g, () => "");
      await fse.writeFile(file, fileData, "utf8");
    }
  }

  // Move the adjusted/formatted JSON ABIs from the temporary directory into the git-controlled JSON ABI folder
  for (const file of files) {
    const fileName = path.basename(file);
    const finalOutputFile = path
      .join(inputJsonDirectory, fileName)
      .split(path.sep)
      .join("/");
    await fse.copy(file, finalOutputFile, { overwrite: true });
  }

  await fse.rm(outputJsonDirectory, { recursive: true, force: true });

  logger.info("Completed");
})();
