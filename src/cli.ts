import * as fs from 'fs';

import * as AppPackage from '@fitbit/app-package';
import * as JSZip from 'jszip';
import * as yargs from 'yargs';

import convert from './convert';

async function convertCommand(
  snapshotPath: string,
  fbaPath: string,
  outputPath: string,
  deviceType: string,
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

  const convertedSnapshot = await convert(
    snapshotBuffer,
    'jerryscript-1',
    fba.sourceMaps.device[deviceType],
  );

  fs.writeFileSync(outputPath, JSON.stringify(convertedSnapshot));
}

yargs.help().command(
  // $0 makes this the default command
  ['convert <snapshot> <fba> <output> <deviceType>', '$0'],
  'Convert heap snapshot',
  (args) =>
    args
      .positional('snapshot', {
        description: 'Heap snapshot path',
        type: 'string',
      })
      .positional('fba', { description: 'FBA file path', type: 'string' })
      .positional('output', {
        description: 'Output heap data JSON file path',
        type: 'string',
      })
      .positional('deviceType', { description: 'Device type', type: 'string' })
      .required(['snapshot', 'fba', 'output', 'deviceType']),
  (args) => {
    return convertCommand(
      args.snapshot,
      args.fba,
      args.output,
      args.deviceType,
    ).catch((error) => {
      process.exitCode = 1;
      if (error) console.error(error);
    });
  },
).argv;

