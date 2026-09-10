import { forwardRef } from 'react';

/**
 * Komponen kartu struk "Rincian Transaksi QRIS"
 * Murni mengimplementasikan template HTML autentik struk m-banking/e-wallet Indonesia
 */
export const QrisReceiptCard = forwardRef(function QrisReceiptCard(
  {
    amountText = 'Rp200.000',
    randomSuffix = 'bZ9xKw',
    txPart1 = '04202607020913',
    txPart2 = '38pYm4tQbZ9xK',
    txPart3 = 'w',
    dateText = '2 Jul 2026 - 16:13',
    bank = 'Mandiri',
    qrType = 'QR statis',
    nmid = 'ID1026849173025',
    storeName = 'CookPlan',
    onCopyTx,
    onBackClick,
    onHelpClick,
  },
  ref
) {
  return (
    <div
      ref={ref}
      className="relative w-full max-w-[420px] bg-[#f5f7f9] min-h-[640px] rounded-[36px] shadow-xl overflow-hidden flex flex-col justify-between text-left select-none font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif]"
    >
      {/* Top Bar Navigation */}
      <div>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          {/* Back Arrow Button */}
          <button
            type="button"
            onClick={onBackClick}
            aria-label="Kembali"
            className="text-[#2b313a] hover:opacity-75 transition-opacity p-1 cursor-pointer"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>

          {/* Help (?) Circle Button */}
          <button
            type="button"
            onClick={onHelpClick}
            aria-label="Bantuan"
            className="w-7 h-7 rounded-full bg-[#4e5562] text-white flex items-center justify-center text-xs font-bold hover:opacity-90 cursor-pointer"
          >
            ?
          </button>
        </div>

        {/* Main Receipt Card */}
        <div className="mx-3 mt-1 bg-white rounded-2xl shadow-sm px-5 pt-7 pb-16 border border-gray-100">
          {/* QR / Store Icon Badge */}
          <div className="flex justify-center mb-4">
            <div className="w-[66px] h-[66px] rounded-full bg-[#c2ecf9] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#00a2db]" fill="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="3" width="7" height="7" rx="2" />
                <rect x="3" y="14" width="7" height="7" rx="2" />
                <rect x="14" y="14" width="7" height="7" rx="2" />
              </svg>
            </div>
          </div>

          {/* Amount & Status Subtitles */}
          <div className="text-center">
            <h1 className="text-[26px] font-extrabold text-[#00880d] tracking-tight">
              {amountText}
            </h1>
            <p className="text-[14px] font-medium text-[#737d8c] mt-1.5">
              QRIS
            </p>
            <p className="text-[14px] font-medium text-[#737d8c] mt-1">
              QRIS - {randomSuffix}
            </p>
          </div>

          {/* Dashed Divider */}
          <div className="border-t border-dashed border-gray-200 my-5" />

          {/* Section Title */}
          <h2 className="text-[14.5px] font-bold text-[#1e242e] mb-4">
            Rincian transaksi
          </h2>

          {/* Data Rows */}
          <div className="space-y-3.5 text-[13.5px]">
            {/* Status */}
            <div className="flex justify-between items-center">
              <span className="text-[#737d8c] font-normal">Status</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#00880d] font-semibold text-[14px]">Selesai</span>
                <span className="w-[18px] h-[18px] rounded-full bg-[#00880d] flex items-center justify-center text-white">
                  <svg className="w-3 h-3 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
              </div>
            </div>

            {/* No. Transaksi */}
            <div className="flex justify-between items-start pt-1">
              <span className="text-[#737d8c] font-normal shrink-0">No. transaksi</span>
              <div className="text-right max-w-[210px]">
                <div className="flex items-center justify-end gap-1.5 text-[#1e242e] font-medium leading-tight">
                  <span>{txPart1}</span>
                </div>
                <div className="flex items-center justify-end gap-1 text-[#1e242e] font-medium leading-tight mt-0.5">
                  <span>{txPart2}</span>
                  {/* Copy Icon Button */}
                  <button
                    type="button"
                    onClick={onCopyTx}
                    title="Salin nomor transaksi"
                    aria-label="Salin nomor transaksi"
                    className="cursor-pointer inline-flex items-center justify-center p-0.5 text-[#3b434f] hover:text-black transition-colors"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
                <div className="text-[#1e242e] font-medium leading-tight">
                  {txPart3}
                </div>
              </div>
            </div>

            {/* Transaksi dibuat */}
            <div className="flex justify-between items-center pt-1">
              <span className="text-[#737d8c] font-normal">Transaksi dibuat</span>
              <span className="text-[#1e242e] font-medium">{dateText}</span>
            </div>

            {/* Status diperbarui */}
            <div className="flex justify-between items-center">
              <span className="text-[#737d8c] font-normal">Status diperbarui</span>
              <span className="text-[#1e242e] font-medium">{dateText}</span>
            </div>

            <div className="pt-1" />

            {/* Metode pembayaran */}
            <div className="flex justify-between items-center">
              <span className="text-[#737d8c] font-normal">Metode pembayaran</span>
              <span className="text-[#1e242e] font-medium">QRIS</span>
            </div>

            {/* Jenis QR */}
            <div className="flex justify-between items-center">
              <span className="text-[#737d8c] font-normal">Jenis QR</span>
              <span className="text-[#1e242e] font-medium">{qrType}</span>
            </div>

            {/* Dibayar dari */}
            <div className="flex justify-between items-center">
              <span className="text-[#737d8c] font-normal">Dibayar dari</span>
              <span className="text-[#1e242e] font-medium">{bank}</span>
            </div>

            {/* NMID */}
            <div className="flex justify-between items-center">
              <span className="text-[#737d8c] font-normal">NMID</span>
              <span className="text-[#1e242e] font-medium">{nmid}</span>
            </div>

            {/* Nama toko */}
            <div className="flex justify-between items-center">
              <span className="text-[#737d8c] font-normal">Nama toko</span>
              <span className="text-[#1e242e] font-medium">{storeName}</span>
            </div>

            {/* Dashed Divider */}
            <div className="border-t border-dashed border-gray-200 !my-4" />

            {/* Jumlah */}
            <div className="flex justify-between items-center">
              <span className="text-[#737d8c] font-normal">Jumlah</span>
              <span className="text-[#1e242e] font-medium">{amountText}</span>
            </div>

            {/* MDR */}
            <div className="flex justify-between items-center">
              <span className="text-[#737d8c] font-normal">MDR</span>
              <span className="text-[#1e242e] font-medium">--</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Refund Bar */}
      <div className="sticky bottom-0 w-full bg-white rounded-t-[28px] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-6 pt-3 pb-6 border-t border-gray-100 flex flex-col items-center">
        {/* Refund Icon */}
        <div className="relative mb-1 mt-0.5">
          {/* Cash / Bill Icon */}
          <div className="w-8 h-6 bg-[#00aa5b] rounded-[4px] relative flex items-center justify-center shadow-sm">
            <div className="w-3.5 h-3.5 rounded-full bg-white/25" />
          </div>
          {/* Arrow circle top-right */}
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#e53935] text-white flex items-center justify-center border border-white">
            <svg className="w-2.5 h-2.5 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5v-15m0 0l-4 4m4-4l4 4" />
            </svg>
          </div>
        </div>

        {/* Action Label */}
        <span className="text-[12.5px] font-medium text-[#737d8c]">
          Pengembalian uang
        </span>
      </div>
    </div>
  );
});
