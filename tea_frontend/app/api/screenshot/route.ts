import { NextRequest, NextResponse } from 'next/server';

type CaptureProps = {
  base64image: string;
  id: number;
  token: string;
};

export async function POST(request: NextRequest) {
  const { base64image, id, token }: CaptureProps = await request.json();
  const filename = `chart-screenshot-case-${id}.png`;

  // Convert base64 string to Blob if needed
  const blob = base64ToBlob(base64image, 'image/png');

  try {
    const formdata = new FormData();
    formdata.append('media', blob, filename);

    const requestOptions: RequestInit = {
      method: 'POST',
      body: formdata,
      redirect: 'follow',
      headers: {
        Authorization: `Token ${token}`,
      },
    };

    const response = await fetch(
      `${process.env.API_URL || process.env.NEXT_PUBLIC_API_URL}/api/cases/${id}/image`,
      requestOptions
    );
    const { message, data } = await response.json();
    return NextResponse.json({ message, data });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error, message: "Couldn't upload image" });
  }
}

// Utility function to convert base64 to Blob
function base64ToBlob(base64: string, mimeType: string) {
  const byteString = atob(base64.split(',')[1]); // Decode base64
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }

  return new Blob([uint8Array], { type: mimeType });
}
