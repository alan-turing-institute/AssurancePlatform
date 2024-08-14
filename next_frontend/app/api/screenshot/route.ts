import fs from 'fs';
import path from 'path';
import { BlobServiceClient } from "@azure/storage-blob";
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { base64, id } = await request.json()
  const filename = `chart-screenshot-case-${id}.png`

  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')

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
    return NextResponse.json({ imageUrl })

  } catch (error) {
    console.log(error)
    return NextResponse.json({ error, message: 'Couldnt upload image' })
  }


  // try {
  //   // Remove header from base64 string
  //   const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  //   // Create buffer from base64 string
  //   const buffer = Buffer.from(base64Data, 'base64');

  //   // Save to azure
  //   const imageUrl = await saveToStorage(buffer, filename)
  //   return imageUrl
  // } catch (error) {
  //   console.error('Error saving image:', error);
  //   throw error;
  // }

  ////Read files from the file system using Node.js fs module
  // const templatesDir = path.resolve(process.cwd(), 'caseTemplates');
  // const files = fs.readdirSync(templatesDir);

  // // Filter JSON files
  // const jsonFiles = files.filter(file => file.endsWith('.json'));

  // // Read JSON content and parse it
  // const newTemplates = jsonFiles.map(file => {
  //   const filePath = path.join(templatesDir, file);
  //   const content = fs.readFileSync(filePath, 'utf-8');
  //   return JSON.parse(content);
  // });

  // // Find default case
  // let defaultCase = newTemplates.find(c => c.name === 'empty') || newTemplates[0];

  // return NextResponse.json({ newTemplates, defaultCase })
}
