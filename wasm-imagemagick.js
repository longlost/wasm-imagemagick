
// Use this module for applications in the browser.
// It is highly recommended to run this module on a Web Worker thread.

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

  // Release unused memory ASAP.
  collection.forEach(obj => {
    const {inputName} = obj;

    // 'mogrify' option uses the same file name
    // since it is an overwrite operation.
    if (inputName === name) { return; }
    
    // Cleanup read file.
    FS.unlink(inputName);    
  });

  const read = FS.readFile(name);

  // Release unused memory ASAP.
  FS.unlink(name);

  return new File([read], name, {type});
};


const argsErrorMessage = `
  Please provide all required inputs to the 'magick' function.

  This tool accepts an object as its single parameter with the following required entries:

  
    'commands' --> An array of strings that follow the ImageMagick api.

    'fileCollection' --> An array of objects that each contain a File object, 
                         along with an 'inputName', which corresponds
                         to the file name used in the 'commands' array. (ie. [{file, inputName}])

  
  For 'convert' and 'mogrify' commands, you must also provide these additional properties to the arguments object.

    'outputName' --> A string which is used as the file name of the newly created output file.

    'outputType' --> A mime-type string that is to set the output file type.
`;

// Object --> Promise --> Array or File
//
// `commands` is an array of strings that follow the ImageMagick api.
//
// ImageMagick can work with more than one image at a time (ie. combine two images), thus:
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
// For 'identify'              - returns a Promise that resolves to an array of strings.
// For 'convert' and 'mogrify' - returns a Promise that resolves to a JS File object.
const magick = async ({commands, fileCollection, outputName, outputType}) => {

  if (!Array.isArray(commands) || !Array.isArray(fileCollection)) {    
    throw new Error(argsErrorMessage);
  }

  // 'convert' and 'mogrify' require outputName AND outputType params.
  if (commands[0] !== 'identify' && (!outputName || !outputType)) {
    throw new Error(argsErrorMessage);
  }  

  try {
    const bufferPromises = fileCollection.map(obj => readAsArrayBuffer(obj.file));
    const buffers        = await Promise.all(bufferPromises);

    writeFiles(fileCollection, buffers);

    const output = await callMain(commands);

    if (commands[0] === 'identify') {

      // Release unused memory ASAP.
      fileCollection.forEach(obj => {
        FS.unlink(obj.inputName);    
      });

      // An array of one or more strings.
      // See https://imagemagick.org/script/identify.php 
      // for specifics on output format.
      return output;
    }
    else {

      // 'await' here in order to catch and handle errors.
      const file = await getProcessedFile(fileCollection, outputName, outputType);

      return file;
    }
  }
  catch (error) {
    
    // Release unused memory ASAP.
    if (Array.isArray(fileCollection)) {      
      fileCollection.forEach(obj => {
        try {
          FS.unlink(obj.inputName);  
        }
        catch (_) {}    
      });
    }

    // Release unused memory ASAP.
    // 'mogrify' then output files have same name, so skip.
    if (commands[0] !== 'mogrify' && outputName) {
      try {
        FS.unlink(outputName);
      }
      catch (_) {}
    }

    throw error;
  }
};


export default magick;
