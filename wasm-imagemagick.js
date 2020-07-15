
// Use this module for applications in the browser.
// It is highly recommended to be ran on a Web Worker thread.

import {FS, callMain} from './wasm-interface.js';


const readAsArrayBuffer = file => {

  const reader = new FileReader();
  reader.readAsArrayBuffer(file);

  return new Promise((resolve, reject) => {

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = reject;
  });
};
   
// Add files to the mock File System so the 
// ImageMagick C code can access them.
const writeFiles = (collection, buffers) => { 
  collection.forEach((obj, index) => {
    const buffer = buffers[index];
    const data   = new Uint8Array(buffer);

    FS.writeFile(obj.inputName, data);
  });
};

// Pull processed file data from File System.
const getProcessedFile = (collection, name, type) => {

  collection.forEach(obj => {

    // Cleanup read file.
    FS.unlink(obj.inputName);    
  });

  const read = FS.readFile(name);

  FS.unlink(name);

  return new File([read], name, {type});
};


// Object --> Promise --> File
//
// `commands` is an array of strings that follow the ImageMagick api.
//
// ImageMagick can work with more than one image at a time, thus:
//
// `fileCollection` is an array of objects that each contain
// a File object, along with an `inputName`, which corresponds
// to the file name used in the `commands` array.
// (ie. [{inputName, file}])
//
// `outputName` is the file name of the newly created output file.
//
// `outputType` is the mime-type applied to the newly created output file.
//
// Returns a Promise that resolves to a JS File object.


// TODO:
//
//      Integrate 'identify' and 'mogrify' ImageMagick commands.


const magick = async ({commands, fileCollection, outputName, outputType}) => {

  if (!Array.isArray(commands) || !Array.isArray(fileCollection) || !outputName || !outputType) {
    throw new Error(`
      Please provide all required inputs to 'magick'.

      This tool accepts an object as its single input with the following required entries:

      'commands' --> An array of strings that follow the ImageMagick api.

      'fileCollection' --> An array of objects that each contain a File object, 
                           along with an 'inputName', which corresponds
                           to the file name used in the 'commands' array. (ie. [{file, inputName}])

      'outputName' --> A string which is used as the file name of the newly created output file.

      'outputType' --> A mime-type string that is to set the output file type.
    `);
  }

  try {

    const bufferPromises = fileCollection.map(obj => readAsArrayBuffer(obj.file));
    const buffers        = await Promise.all(bufferPromises);

    writeFiles(fileCollection, buffers);

    await callMain(commands);

    // 'await' here in order to catch and handle errors.
    const file = await getProcessedFile(fileCollection, outputName, outputType);

    return file;
  }
  catch (error) {
    
    fileCollection.forEach(obj => {
      FS.unlink(obj.inputName);      
    });

    // Cleanup source files.
    // 'mogrify' then output files have same name, so skip.
    if (commands[0] !== 'mogrify') {
      FS.unlink(outputName);
    }

    throw error;
  }
};


export default magick;
