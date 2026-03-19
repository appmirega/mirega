interface QRCardProps {
  qrDataURL: string;
  buildingName: string;
  elevatorLabel: string;
}

export function QRCard({ qrDataURL, buildingName, elevatorLabel }: QRCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="text-center space-y-2">
        <div className="min-h-[40px] flex items-center justify-center">
          <h3 className="text-sm font-bold text-slate-900 uppercase leading-tight">
            {buildingName}
          </h3>
        </div>

        <div className="min-h-[24px] flex items-center justify-center">
          <p className="text-sm font-semibold text-slate-700 leading-tight">
            {elevatorLabel}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-center">
          <img
            src={qrDataURL}
            alt={`QR ${buildingName} ${elevatorLabel}`}
            className="w-[180px] h-[180px] object-contain"
          />
        </div>
      </div>
    </div>
  );
}