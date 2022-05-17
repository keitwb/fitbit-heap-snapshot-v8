import * as fs from 'fs';
import { write as gexfWrite } from "graphology-gexf";

import * as AppPackage from '@fitbit/app-package';
import * as JSZip from 'jszip';
import * as yargs from 'yargs';

import { generateGraph, generateV8HeapSnapshot } from './convert';

enum OutputFormat {
  V8,
  GEXF,
}

async function convertCommand(
  snapshotPath: string,
  fbaPath: string,
  outputPath: string,
  deviceType: string,
  outputFormat: OutputFormat,
) {
  const fbaData = fs.readFileSync(fbaPath);
  const fbaZip = await JSZip.loadAsync(fbaData);
  const fba = await AppPackage.fromJSZip(fbaZip);

  const snapshotBuffer = fs.readFileSync(snapshotPath);

  if (
    !fba.sourceMaps ||
    !fba.sourceMaps.device ||
    !fba.sourceMaps.device[deviceType]
  ) {
    throw new Error(
      'Provided FBA file does not contain sourcemaps for requested device type!',
    );
  }

  const graph = await generateGraph(snapshotBuffer, 'jerryscript-1', fba.sourceMaps.device[deviceType]);

  let out: string;
  if (outputFormat === OutputFormat.V8) {
    const convertedSnapshot = generateV8HeapSnapshot(graph);
    out = JSON.stringify(convertedSnapshot);
  } else if (outputFormat === OutputFormat.GEXF) {
    out = gexfWrite(graph);
  } else {
    throw new Error("Unknown output format");
  }

  fs.writeFileSync(outputPath, out);
}

const builder = (args: yargs.Argv<{}>) =>
  args
    .positional('snapshot', {
      description: 'Heap snapshot path',
      type: 'string',
    })
    .positional('fba', { description: 'FBA file path', type: 'string' })
    .positional('output', {
      description: 'Output heap data file path',
      type: 'string',
    })
    .positional('deviceType', { description: 'Device type', type: 'string' })
    .required(['snapshot', 'fba', 'output', 'deviceType']);

const cmd = (args: any, outFormat: OutputFormat) => convertCommand(
  args.snapshot,
  args.fba,
  args.output,
  args.deviceType,
  outFormat,
).catch((error) => {
  process.exitCode = 1;
  if (error) console.error(error);
});

yargs.command(
  'v8 <snapshot> <fba> <output> <deviceType>',
  'Convert heap snapshot to v8 heap snapshot',
  builder,
  (args) => {
    return cmd(args, OutputFormat.V8);
  },
).command(
  'gexf <snapshot> <fba> <output> <deviceType>',
  'Convert heap snapshot to a GEXF graph',
  builder,
  (args) => {
    return cmd(args, OutputFormat.GEXF);
  },
)
  .demandCommand()
  .help()
  .argv;

