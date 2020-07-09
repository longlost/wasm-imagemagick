
// Use this module for applications in the browser.

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
const getProcessedFile = (collection, outputName) => {

  collection.forEach(obj => {

    // Cleanup read file.
    FS.unlink(obj.inputName);    
  });

  const read = FS.readFile(outputName);

  FS.unlink(outputName);

  return new File([read], outputName);
};


// Array, Array --> Promise --> Array
//
// ImageMagick can work with more than one image at a time.
//
// 'fileCollection' is an array of objects that each contain
// a File object, along with an inputName and outputName.
// (ie. [{inputName, file, outputName}])
//
// 'commands' is an array of strings that follow the ImageMagick api.
//
// Returns a Promise that resolves to an array of File objects.

// TODO:
//
//      Integrate 'identify' and 'mogrify' ImageMagick commands.

const magick = async (fileCollection, outputName, commands) => {
  try {

    const bufferPromises = fileCollection.map(obj => readAsArrayBuffer(obj.file));
    const buffers        = await Promise.all(bufferPromises);

    writeFiles(fileCollection, buffers);

    await callMain(commands);

    // 'await' here in order to catch and handle errors.
    const file = await getProcessedFile(fileCollection, outputName);

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
