const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
 
const buildDir = path.join(__dirname, '..', 'build');
const destinationDir = path.join(__dirname, '..', '..', 'public', 'documentation');
 
// Run docusaurus build first
exec('docusaurus build', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error during build: ${stderr}`);
    process.exit(1);
  }
 
  console.log('Build successful:', stdout);
 
  // Remove the destination directory if it exists
  fs.remove(destinationDir, (err) => {
    if (err) {
      console.error(`Error removing old documentation: ${err}`);
      process.exit(1);
    }
 
    console.log('Old documentation removed.');
 
    // Move the new build directory
    fs.move(buildDir, destinationDir, (err) => {
      if (err) {
        console.error(`Error moving build to documentation: ${err}`);
        process.exit(1);
      }
 
      console.log('Build successfully moved to documentation folder.');
    });
  });
});