interface QRCardProps {
  qrDataURL: string;
  buildingName: string;
}

export function QRCard({ qrDataURL, buildingName }: QRCardProps) {
  return (
    <div
      className="bg-white border-2 border-black rounded-2xl overflow-hidden"
      style={{
        width: '112px',
        height: '150px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="bg-white flex items-center justify-center"
        style={{
          width: '100px',
          height: '100px',
          margin: '6px auto 0',
        }}
      >
        <img
          src={qrDataURL}
          alt={`QR ${buildingName}`}
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        />
      </div>

      <div
        className="bg-white text-center"
        style={{
          padding: '4px 6px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <div style={{ fontSize: '12pt', color: '#000', fontWeight: 'normal', lineHeight: '1.2' }}>
          Edificio:
        </div>
        <div style={{ fontSize: '21pt', color: '#DC2626', fontWeight: 'bold', lineHeight: '1.1', marginTop: '2px' }}>
          {buildingName}
        </div>
      </div>
    </div>
  );
}
