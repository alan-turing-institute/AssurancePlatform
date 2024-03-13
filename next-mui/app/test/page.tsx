'use client'

import Image from "next/image";
import { Inter } from "next/font/google";
import { useEffect, useState } from "react";
import { Mermaid } from "@/components/MermaidTest";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");

  const name = input ? input.replace(/\s/g, "-").toLowerCase() : "";

  const [chart, setChart] = useState("");

  useEffect(() => {
    setChart(`
      flowchart TD
        Start --> Stop
      `);
  },[])

  return (
    <div className="flex justify-end items-center flex-col h-screen">
      <div className="flex-1 flex justify-center border-2 border-dashed w-full overflow-scroll">
        {loading ? (
          <div className="flex flex-col justify-center animate-pulse">
            <h1 className="text-7xl font-black">Loading...</h1>
          </div>
        ) : (
          <>
            {!!chart ? (
              <Mermaid chart={chart} name={name} />
            ) : (
              <div className="flex flex-col justify-center text-white">
                <p>No Chart</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
