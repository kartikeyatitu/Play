"use client";

import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface StudentQRCodeProps {
  studentId: string;
  studentName: string;
}

export function StudentQRCode({ studentId, studentName }: StudentQRCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const generateQR = async () => {
      try {
        const qrValue = `TRIQ:CHECKIN:${studentId}`;
        // Load the QR library on demand (keeps it out of the main bundle)
        const QRCode = await import("qrcode");
        const url = await QRCode.toDataURL(qrValue, {
          margin: 1,
          width: 200,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
        setQrDataUrl(url);

        if (canvasRef.current) {
          QRCode.toCanvas(canvasRef.current, qrValue, {
            margin: 1,
            width: 200,
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
          });
        }
      } catch (err) {
        console.error("Error generating QR code", err);
      }
    };
    generateQR();
  }, [studentId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `student-qr-${studentId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="flex flex-col items-center p-6 bg-zinc-900/50 border-zinc-800/50 max-w-sm mx-auto">
      <div className="mb-4 bg-[#fff] p-2 rounded-lg print:border-none print:shadow-none shadow-sm">
        <canvas ref={canvasRef} className="rounded" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-100 mb-6">{studentName}</h3>
      <div className="flex gap-4 w-full print:hidden">
        <Button variant="outline" className="flex-1" onClick={handlePrint}>
          Print
        </Button>
        <Button className="flex-1 bg-lime-500 hover:bg-lime-600 text-zinc-950" onClick={handleDownload}>
          Download
        </Button>
      </div>
    </Card>
  );
}
