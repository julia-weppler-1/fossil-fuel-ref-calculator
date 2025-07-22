import React, { useState, useRef } from 'react';
import './index.css';
import * as XLSX from 'xlsx';

export default function ChartCard({ title, children }) {
  const [menuOpen, setMenuOpen]   = useState(false);
  const [chartData, setChartData] = useState([]);
  const containerRef              = useRef();
  const svgRef                    = useRef();

  // CSV download
  const downloadCSV = () => {
    const ws   = XLSX.utils.json_to_sheet(chartData);
    const csv  = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${title.replace(/\s+/g,'-').toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  // PNG download
  const downloadPNG = () => {
    const svgEl = svgRef.current;
    const xml   = new XMLSerializer().serializeToString(svgEl);
    const blob  = new Blob([xml], { type: 'image/svg+xml' });
    const url   = URL.createObjectURL(blob);
    const img   = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width  = svgEl.clientWidth;
      c.height = svgEl.clientHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob((b) => {
        const link = document.createElement('a');
        link.href    = URL.createObjectURL(b);
        link.download= `${title.replace(/\s+/g,'-').toLowerCase()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    };
    img.src = url;
    setMenuOpen(false);
  };

  // clone the chart, injecting onDataReady & svgRef
  const chartWithProps = React.cloneElement(children, {
    onDataReady: setChartData,
    svgRef
  });

  return (
    <div
      ref={containerRef}
      className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col"
    >
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className="text-lg font-semibold text-gray-800">{title}</span>

        <div className="relative">
            <button
                onClick={() => setMenuOpen(o => !o)}
                className="p-1 hover:bg-gray-100 rounded-full"
            >
                <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 text-gray-600"
                >
                <g id="SVGRepo_bgCarrier" strokeWidth="0" />
                <g
                    id="SVGRepo_tracerCarrier"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <g id="SVGRepo_iconCarrier">
                    <path
                    d="M12.5535 16.5061C12.4114 16.6615 12.2106 16.75 12 16.75C11.7894 16.75 11.5886 16.6615 11.4465 16.5061L7.44648 12.1311C7.16698 11.8254 7.18822 11.351 7.49392 11.0715C7.79963 10.792 8.27402 10.8132 8.55352 11.1189L11.25 14.0682V3C11.25 2.58579 11.5858 2.25 12 2.25C12.4142 2.25 12.75 2.58579 12.75 3V14.0682L15.4465 11.1189C15.726 10.8132 16.2004 10.792 16.5061 11.0715C16.8118 11.351 16.833 11.8254 16.5535 12.1311L12.5535 16.5061Z"
                    fill="#1F2937"
                    />
                    <path
                    d="M3.75 15C3.75 14.5858 3.41422 14.25 3 14.25C2.58579 14.25 2.25 14.5858 2.25 15V15.0549C2.24998 16.4225 2.24996 17.5248 2.36652 18.3918C2.48754 19.2919 2.74643 20.0497 3.34835 20.6516C3.95027 21.2536 4.70814 21.5125 5.60825 21.6335C6.47522 21.75 7.57754 21.75 8.94513 21.75H15.0549C16.4225 21.75 17.5248 21.75 18.3918 21.6335C19.2919 21.5125 20.0497 21.2536 20.6517 20.6516C21.2536 20.0497 21.5125 19.2919 21.6335 18.3918C21.75 17.5248 21.75 16.4225 21.75 15.0549V15C21.75 14.5858 21.4142 14.25 21 14.25C20.5858 14.25 20.25 14.5858 20.25 15C20.25 16.4354 20.2484 17.4365 20.1469 18.1919C20.0482 18.9257 19.8678 19.3142 19.591 19.591C19.3142 19.8678 18.9257 20.0482 18.1919 20.1469C17.4365 20.2484 16.4354 20.25 15 20.25H9C7.56459 20.25 6.56347 20.2484 5.80812 20.1469C5.07435 20.0482 4.68577 19.8678 4.40901 19.591C4.13225 19.3142 3.9518 18.9257 3.85315 18.1919C3.75159 17.4365 3.75 16.4354 3.75 15Z"
                    fill="#1F2937"
                    />
                </g>
                </svg>
            </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white border-2 border-gray-200 rounded-lg shadow-lg z-10">
              <button
                onClick={downloadPNG}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Download Image
              </button>
              <button
                onClick={downloadCSV}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Download CSV
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1">
        {chartWithProps}
      </div>
    </div>
  );
}
