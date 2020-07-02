
// Use this module for applications in the browser.

import {FS, callMain, mod} from './wasm-interface.js';

const directory = '/pictures';

mod.Module.onRuntimeInitialized = () => {
  FS.mkdir(directory);
  FS.chdir(directory);
};




// // TESTING ONLY!!!
// // Can get it to run but the .wasm file cannot resole the FS paths correctly,
// // so the c code never finds the image files to process.
// import {FS, Module} from './original-code-formatted.js';
// const callMain = Module['callMain'];


// const directory = '/pictures';


// Module.onRuntimeInitialized = () => {
//   FS.mkdir(directory);
//   FS.currentPath = directory;
// };

// Can overwrite Module.locateFile to work with webpack if needed.




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


const getProcessedFiles = types => {
  const dir        = FS.open(directory);  
  const {contents} = dir.node;



  // TODO:
  //
  //      Align type with content key since Object.keys is not ordered
  //      the same as incoming files or types.



  const files = Object.keys(contents).map((key, index) => {
    const read = FS.readFile(key);

    // Cleanup read file.
    FS.unlink(key);

    return new File([read], key, {type: types[index]});
  });
    
  return files;
};


const magick = async (files, commands) => {

  const bufferPromises = files.map(file => readAsArrayBuffer(file));
  const buffers        = await Promise.all(bufferPromises);  

  try {
    // ImageMagick can work with more than one image at a time.
    files.forEach((file, index) => {
      const buffer = buffers[index];
      const data   = new Uint8Array(buffer);


      // FS.writeFile(file.name, data);
      // console.log('writeFile name: ', `input_${file.name}`);

      FS.writeFile(`input_${file.name}`, data);

    });


    callMain(commands);

    // const types     = files.map(file => file.type);    
    // const processed = getProcessedFiles(types);

    // return processed;

    return;
  }
  catch (error) {
    console.error(error);

    // Cleanup source files.
    // 'mogrify' then output files have same name, so skip.
    if (commands[0] !== 'mogrify') {
      files.forEach(file => {
        FS.unlink(file.name);
      });
    }
  }

};

export default magick;
