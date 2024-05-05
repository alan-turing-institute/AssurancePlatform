'use server'

// Import required modules
import fs from 'fs';
import path from 'path';

// Function to save base64 image to file
export const capture = async (base64Image: string, assuranceCaseId: string) => {
  const imageName = `chart-screenshot-case-${assuranceCaseId}.png`
  try {
    // Remove header from base64 string
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

    // Create buffer from base64 string
    const buffer = Buffer.from(base64Data, 'base64');

    // Define file path in public directory
    const filePath = path.join(process.cwd(), 'public', imageName);

    // Write buffer to file
    fs.writeFileSync(filePath, buffer);

    console.log('Image saved successfully:', filePath);
    console.log(filePath)
    return true
  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
};

export const existingImage = async (filePath: string) => {
  try {
    // Check if the file exists by trying to read its stats
    fs.statSync(filePath);
    return true; // File exists
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File does not exist
      return false;
    } else {
      // Other error occurred (e.g., permission issue)
      console.error('Error checking file existence:', error);
      return false; // Return false to indicate the file does not exist
    }
  }
}