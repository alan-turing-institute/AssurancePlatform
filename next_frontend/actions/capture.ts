'use server'

// Import required modules
import fs from 'fs';
import path from 'path';
import { BlobServiceClient } from "@azure/storage-blob";
import { revalidatePath } from 'next/cache';

// Function to save base64 image to file
export const capture = async (base64Image: string, assuranceCaseId: string) => {
  const filename = `chart-screenshot-case-${assuranceCaseId}.png`
  try {
    // Remove header from base64 string
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

    // Create buffer from base64 string
    const buffer = Buffer.from(base64Data, 'base64');

    // Save to azure
    const imageUrl = await saveToStorage(buffer, filename)
    return imageUrl

    // Define file path in public directory
    // const filePath = path.join(process.cwd(), 'public', imageName);

    // // Write buffer to file
    // fs.writeFileSync(filePath, buffer);

    // console.log('Image saved successfully:', filePath);
    // console.log(filePath)
    // return true
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

const saveToStorage = async (buffer: Buffer, filename : string) => {
  try {
    const containerName = 'sample-container'
    const account = process.env.NEXT_PUBLIC_STORAGESOURCENAME

    const blobSasUrl = 'https://teamedia.blob.core.windows.net/?sv=2022-11-02&ss=bfqt&srt=co&sp=rwdlacupiytfx&se=2025-05-06T03:42:08Z&st=2024-05-05T19:42:08Z&spr=https&sig=eAyqjGI6Tz5jzZi%2FWrVr%2BGfMnTR%2Fnbe8HLbDYuoVnMY%3D'

    const blobServiceClient = new BlobServiceClient(blobSasUrl)

    // Get a reference to a container
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const blockBlobClient = containerClient.getBlockBlobClient(filename);
    await blockBlobClient.uploadData(buffer);

    // Return the URL of the uploaded image
    const imageUrl = `https://${account}.blob.core.windows.net/${containerName}/${filename}`;
    return imageUrl

  } catch (error) {
    console.log('Error', error)
  }
}

export const test = async () => {
  return true
}