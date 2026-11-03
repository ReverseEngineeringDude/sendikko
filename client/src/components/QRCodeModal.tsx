import { QRCodeSVG } from 'qrcode.react';
import { Dialog } from './ui/Dialog.tsx';
import { Button } from './ui/Button.tsx';
import { Download } from 'lucide-react';

export interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  code: string;
}

export const QRCodeModal = ({ isOpen, onClose, url, code }: QRCodeModalProps) => {
  const downloadQRCode = () => {
    const svgElement = document.getElementById('sendikko-qr-code');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `sendikko-${code}-qr.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Scan to Download"
      description={`Unique Code: ${code}`}
      maxWidth="sm"
    >
      <div className="flex flex-col items-center justify-center p-4 gap-6">
        <div className="p-4 rounded-2xl bg-white shadow-2xl flex items-center justify-center">
          <QRCodeSVG
            id="sendikko-qr-code"
            value={url}
            size={220}
            level="H"
            includeMargin={true}
          />
        </div>

        <p className="text-xs text-center text-slate-400">
          Scan with any mobile camera or QR scanner. No account required to download.
        </p>

        <div className="w-full flex items-center gap-2">
          <Button variant="outline" className="w-full" onClick={downloadQRCode}>
            <Download className="w-4 h-4 mr-2" /> Download QR
          </Button>
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
