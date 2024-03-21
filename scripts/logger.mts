/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import chalk from "chalk";

export interface ILogger {
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

const logInternal = (
  method: "info" | "warn" | "error",
  symbol: string,
  scriptId,
  ...args: any[]
) => {
  const now = new Date();
  const timestamp = chalk.gray(`[${now.toLocaleTimeString()}]`);
  const scriptIdText = chalk.gray(scriptId);

  console[method](timestamp, symbol, scriptIdText, ...args);
};

const spacer = " ";
const square = `${spacer}\u25A0${spacer}`;
const triangle = `${spacer}\u25B2${spacer}`;
const diamond = `${spacer}\u25C8${spacer}`;

export const logger = (scriptId: string): ILogger => ({
  info(...args: any[]) {
    logInternal("info", chalk.magenta(square), scriptId, ...args);
  },

  warn(...args: any[]) {
    logInternal("warn", chalk.yellow(triangle), scriptId, ...args);
  },

  error(...args: any[]) {
    logInternal(
      "error",
      chalk.bgRedBright.whiteBright(diamond),
      scriptId,
      ...args
    );
  },
});
