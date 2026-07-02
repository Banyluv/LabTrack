import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';

export default function DeliveryNote({ request, onClose }) {
  const componentRef = useRef();

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    pageStyle: `
      @page { size: A5; margin: 8mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
    documentTitle: `Delivery-Note-${request.id}`,
  });

  if (!request) return null;

  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const deliveryQty = request.approved_quantity || request.quantity;

  // Tw classes shared by printable area for clean light‑mode print + dark‑mode screen
  const labelMeta = 'text-xs font-semibold text-gray-400 dark:text-gray-300 uppercase tracking-wider block';
  const valueMeta = 'font-bold text-gray-900 dark:text-gray-100';
  const borderRow = 'border-gray-200 dark:border-gray-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
        {/* ── Modal Header (screen only) ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 rounded-t-2xl print:hidden">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Delivery Note / Dispatch Slip
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              🖨️ Print
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-lg transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* ── Printable Area ── */}
        <div ref={componentRef} className="p-6 print:p-4 print:text-black print:bg-white dark:bg-gray-800">
          {/* ▸ Top Banner */}
          <div className="bg-teal-600 dark:bg-teal-700 text-white -mx-6 -mt-6 px-6 py-5 mb-6 print:bg-teal-600 print:-mx-0 print:-mt-0 print:text-white rounded-t-2xl print:rounded-none">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏥</span>
                  <h1 className="text-xl font-extrabold tracking-tight print:text-xl">LabTrack</h1>
                </div>
                <p className="text-teal-100 dark:text-teal-200 text-xs mt-0.5 print:text-teal-100">
                  Laboratory Consumables Management
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider print:bg-white/20 print:text-white">
                  Delivery Note
                </span>
                <p className="text-teal-100 dark:text-teal-200 text-[10px] mt-1 print:text-teal-100">
                  Ref: DN-{String(request.id).padStart(5, '0')}
                </p>
              </div>
            </div>
          </div>

          {/* ▸ Meta Info */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <span className={labelMeta}>Date Issued</span>
              <span className={valueMeta}>{formattedDate} at {formattedTime}</span>
            </div>
            <div className="text-right">
              <span className={labelMeta}>Request #</span>
              <span className={valueMeta}>REQ-{String(request.id).padStart(5, '0')}</span>
            </div>
            <div>
              <span className={labelMeta}>Approved By</span>
              <span className={valueMeta}>{request.approved_by || 'N/A'}</span>
            </div>
            <div className="text-right">
              <span className={labelMeta}>Status</span>
              <span className="inline-block px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-300 text-xs font-bold">
                APPROVED ✓
              </span>
            </div>
          </div>

          {/* ▸ Item Details Table */}
          <div className={`border-2 ${borderRow} rounded-xl overflow-hidden mb-6 print:border-black`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 print:bg-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Consumable
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Requested
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Approved
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Unit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{request.consumable_name}</td>
                  <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{request.quantity}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-green-700 dark:text-green-400 text-lg">{deliveryQty}</span>
                    {deliveryQty < request.quantity && (
                      <span className="ml-1 text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-semibold">
                        Partial
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{request.unit}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ▸ Destination & Remarks */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <span className={labelMeta}>Deliver To</span>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {request.user_name || 'N/A'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {request.user_facility || 'No facility specified'}
              </p>
              {request.user_email && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{request.user_email}</p>
              )}
            </div>
            <div>
              <span className={labelMeta}>Reason / Remarks</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                {request.admin_comment || request.notes || 'No remarks'}
              </p>
            </div>
          </div>

          {/* ▸ Signature Section */}
          <div className="border-t-2 border-dashed border-gray-300 dark:border-gray-500 pt-4 mt-8 print:border-black">
            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              <div>
                <div className="h-8"></div>
                <div className="border-b border-gray-400 dark:border-gray-400 mt-6 mb-1"></div>
                <span className="text-gray-500 dark:text-gray-300 font-semibold uppercase tracking-wider">Issued By</span>
                <p className="text-gray-700 dark:text-gray-200 font-bold text-sm mt-1">{request.approved_by || 'Admin'}</p>
              </div>
              <div>
                <div className="h-8"></div>
                <div className="border-b border-gray-400 dark:border-gray-400 mt-6 mb-1"></div>
                <span className="text-gray-500 dark:text-gray-300 font-semibold uppercase tracking-wider">Received By</span>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">(Sign upon collection)</p>
              </div>
              <div>
                <div className="h-8"></div>
                <div className="border-b border-gray-400 dark:border-gray-400 mt-6 mb-1"></div>
                <span className="text-gray-500 dark:text-gray-300 font-semibold uppercase tracking-wider">Date Received</span>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">____ / ____ / ______</p>
              </div>
            </div>
          </div>

          {/* ▸ Footer */}
          <div className="text-center text-[10px] text-gray-400 dark:text-gray-500 mt-8 print:text-gray-500">
            <p>This is a system-generated delivery note from ECEWS.</p>
            <p>For inquiries, contact the laboratory consumables manager.</p>
          </div>
        </div>
      </div>
    </div>
  );
}