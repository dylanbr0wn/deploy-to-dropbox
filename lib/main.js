import { Dropbox } from 'dropbox';
import fs from 'fs';
import fetch2 from 'node-fetch';
import * as core from '@actions/core';
import glob from '@actions/glob';
const accessToken = core.getInput('DROPBOX_ACCESS_TOKEN');
const globSource = core.getInput('GLOB');
const dropboxPathPrefix = core.getInput('DROPBOX_DESTINATION_PATH_PREFIX');
const isDebug = core.getInput('DEBUG');
const dropbox = new Dropbox({ accessToken, fetch: fetch2 });
const fileWriteMode = core.getInput('FILE_WRITE_MODE');
let parsedFileWriteMode;
if (fileWriteMode === "overwrite") {
    parsedFileWriteMode = { '.tag': "overwrite" };
}
else {
    parsedFileWriteMode = { '.tag': "add" };
}
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function uploadFile(filePath) {
    const file = fs.readFileSync(filePath);
    const destinationPath = `${dropboxPathPrefix}${filePath}`;
    if (isDebug)
        console.log('uploaded file to Dropbox at: ', destinationPath);
    let max_retry = 5;
    let retry = 0;
    let wait = 0;
    while (1) {
        try {
            return await dropbox
                .filesUpload({ path: destinationPath, contents: file, mode: parsedFileWriteMode });
        }
        catch (err) {
            let error = err;
            if (error?.error?.['.tag'] === "too_many_write_operations") {
                if (retry < max_retry) {
                    wait = error.headers['Retry-After'];
                    console.log("Too many write operations, retrying in ", delay, " seconds");
                    await delay(wait * 1000);
                    retry += 1;
                }
                else {
                    throw err;
                }
            }
            else {
                throw err;
            }
        }
    }
}
async function run() {
    const files = [];
    const globber = await glob.create(globSource);
    for await (const file of globber.globGenerator()) {
        try {
            const res = await uploadFile(file);
            if (res) {
                files.push();
            }
        }
        catch (err) {
            const error = err;
            console.error('error', err);
            core.setFailed(error);
        }
    }
    console.log('Uploaded files', files);
}
await run();